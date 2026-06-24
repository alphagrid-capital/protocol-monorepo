import type { Address, Hex, PrivateKeyAccount } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { ADD_TO_POSITION_TYPES } from '../eip712/add-position.js'
import { hashExitRules, OPEN_POSITION_TYPES } from '../eip712/open-position.js'
import { REDUCE_POSITION_TYPES } from '../eip712/reduce-position.js'
import { parseHumanAmount } from '../tokens/amount-utils.js'
import {
  buildOnChainIntent,
  DEFAULT_EXIT_LADDER,
} from '../trading/intent-builder.js'
import type { StrategyAction, StrategyDecision } from './decision.js'
import type { TradingConfig } from '../trading/config.js'
import { loadTradingConfig } from '../trading/config.js'
import type { TradingService } from '../../services/trading.service.js'
import { TradingError } from '../../services/trading.service.js'
import { getWorkerEnv } from '../worker-env.js'

const TRADE_DEADLINE_SECONDS = 3600

export interface ExecutionActionResult {
  action: StrategyAction
  status: 'ok' | 'failed'
  txHash?: string
  positionId?: string
  error?: string
}

function tradeDeadline(): string {
  return String(Math.floor(Date.now() / 1000) + TRADE_DEADLINE_SECONDS)
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export async function executeStrategyDecision(
  trading: TradingService,
  agentId: string,
  privateKey: Hex,
  decision: StrategyDecision
): Promise<ExecutionActionResult[]> {
  const account = privateKeyToAccount(privateKey)
  const config = loadTradingConfig(getWorkerEnv())
  const results: ExecutionActionResult[] = []

  for (const action of decision.actions) {
    try {
      const outcome = await executeAction(
        trading,
        agentId,
        account,
        config,
        action
      )
      results.push({ action, status: 'ok', ...outcome })
    } catch (error) {
      results.push({
        action,
        status: 'failed',
        error: errorMessage(error, 'Execution failed'),
      })
    }
  }

  return results
}

async function executeAction(
  trading: TradingService,
  agentId: string,
  account: PrivateKeyAccount,
  config: TradingConfig,
  action: StrategyAction
): Promise<{ txHash?: string; positionId?: string }> {
  switch (action.type) {
    case 'open':
      return executeOpen(trading, agentId, account, config, action)
    case 'close':
      return executeReduce(trading, agentId, account, {
        type: 'reduce',
        positionId: action.positionId,
        exitBps: action.exitBps ?? 10000,
      })
    case 'add':
      return executeAdd(trading, agentId, account, config, action)
    case 'reduce':
      return executeReduce(trading, agentId, account, action)
    default: {
      const _exhaustive: never = action
      throw new TradingError(`Unknown action type: ${String(_exhaustive)}`, 400)
    }
  }
}

async function executeOpen(
  trading: TradingService,
  agentId: string,
  account: PrivateKeyAccount,
  config: TradingConfig,
  action: Extract<StrategyAction, { type: 'open' }>
): Promise<{ txHash: string; positionId: string }> {
  const quote = await trading.getQuote(agentId, action.symbol)
  const exits = action.exits ?? quote.defaultExit
  const deadline = tradeDeadline()
  const nonce = quote.nonce
  const intent = buildOnChainIntent({
    agentId: BigInt(agentId),
    vault: quote.vault as Address,
    symbol: action.symbol,
    chainId: config.chainId,
    usdcAmountHuman: action.usdcAmount,
    usdcDecimals: config.usdcDecimals,
    minTokenOut: action.minTokenOut ?? '0',
    maxSlippageBps: action.maxSlippageBps ?? 100,
    exits,
    deadline: BigInt(deadline),
    nonce: BigInt(nonce),
  })
  const signature = await account.signTypedData({
    domain: {
      name: quote.eip712.domainName,
      version: quote.eip712.domainVersion,
      chainId: quote.eip712.chainId,
      verifyingContract: quote.eip712.verifyingContract as Address,
    },
    types: OPEN_POSITION_TYPES,
    primaryType: 'OpenPosition',
    message: {
      agentId: intent.agentId,
      vault: intent.vault,
      token: intent.token,
      usdcAmount: intent.usdcAmount,
      minTokenOut: intent.minTokenOut,
      maxSlippageBps: intent.maxSlippageBps,
      exitsHash: hashExitRules(intent.exits),
      deadline: intent.deadline,
      nonce: intent.nonce,
    },
  })

  const response = await trading.submitIntent(agentId, {
    symbol: action.symbol,
    usdcAmount: action.usdcAmount,
    minTokenOut: action.minTokenOut ?? '0',
    maxSlippageBps: action.maxSlippageBps ?? 100,
    exits: exits.length > 0 ? exits : DEFAULT_EXIT_LADDER,
    deadline,
    nonce,
    signature,
  })

  return {
    txHash: response.transactionHash,
    positionId: response.positionId,
  }
}

async function executeAdd(
  trading: TradingService,
  agentId: string,
  account: PrivateKeyAccount,
  config: TradingConfig,
  action: Extract<StrategyAction, { type: 'add' }>
): Promise<{ txHash: string; positionId: string }> {
  const quote = await trading.getAddQuote(agentId, action.positionId)
  const deadline = tradeDeadline()
  const nonce = quote.nonce
  const usdcAmount = parseHumanAmount(action.usdcAmount, config.usdcDecimals)
  const minTokenOut = BigInt(action.minTokenOut ?? '0')
  const maxSlippageBps = action.maxSlippageBps ?? 100

  const signature = await account.signTypedData({
    domain: {
      name: quote.eip712.domainName,
      version: quote.eip712.domainVersion,
      chainId: quote.eip712.chainId,
      verifyingContract: quote.eip712.verifyingContract,
    },
    types: ADD_TO_POSITION_TYPES,
    primaryType: 'AddToPosition',
    message: {
      agentId: BigInt(agentId),
      positionId: BigInt(action.positionId),
      usdcAmount,
      minTokenOut,
      maxSlippageBps,
      deadline: BigInt(deadline),
      nonce: BigInt(nonce),
    },
  })

  const response = await trading.submitAddIntent(agentId, {
    positionId: action.positionId,
    usdcAmount: action.usdcAmount,
    minTokenOut: action.minTokenOut ?? '0',
    maxSlippageBps,
    deadline,
    nonce,
    signature,
  })

  return {
    txHash: response.transactionHash,
    positionId: response.positionId,
  }
}

async function executeReduce(
  trading: TradingService,
  agentId: string,
  account: PrivateKeyAccount,
  action: Extract<StrategyAction, { type: 'reduce' }>
): Promise<{ txHash: string; positionId: string }> {
  const quote = await trading.getReduceQuote(agentId, action.positionId)
  const deadline = tradeDeadline()
  const nonce = quote.nonce

  const signature = await account.signTypedData({
    domain: {
      name: quote.eip712.domainName,
      version: quote.eip712.domainVersion,
      chainId: quote.eip712.chainId,
      verifyingContract: quote.eip712.verifyingContract,
    },
    types: REDUCE_POSITION_TYPES,
    primaryType: 'ReducePosition',
    message: {
      agentId: BigInt(agentId),
      positionId: BigInt(action.positionId),
      exitBps: action.exitBps,
      deadline: BigInt(deadline),
      nonce: BigInt(nonce),
    },
  })

  const response = await trading.submitReduceIntent(agentId, {
    positionId: action.positionId,
    exitBps: action.exitBps,
    deadline,
    nonce,
    signature,
  })

  return {
    txHash: response.transactionHash,
    positionId: response.positionId,
  }
}
