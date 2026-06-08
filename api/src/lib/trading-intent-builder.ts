import type { Address } from 'viem'
import { parseHumanAmount } from './amount-utils.js'
import { chainTokenAddress } from './token-catalog.js'
import type { ExitRuleInput } from '../schemas/trading.js'

export const DEFAULT_EXIT_LADDER: ExitRuleInput[] = [
  { triggerType: 'StopLoss', triggerBps: -1000, exitBps: 10000 },
]

export interface OnChainExitRule {
  triggerType: 0 | 1
  triggerBps: bigint
  exitBps: number
}

export interface OnChainPositionIntent {
  agentId: bigint
  vault: Address
  token: Address
  usdcAmount: bigint
  minTokenOut: bigint
  maxSlippageBps: number
  exits: OnChainExitRule[]
  deadline: bigint
  nonce: bigint
}

export function mapTriggerType(triggerType: ExitRuleInput['triggerType']): 0 | 1 {
  return triggerType === 'StopLoss' ? 0 : 1
}

export function mapExitRules(exits: ExitRuleInput[]): OnChainExitRule[] {
  return exits.map((rule) => ({
    triggerType: mapTriggerType(rule.triggerType),
    triggerBps: BigInt(rule.triggerBps),
    exitBps: rule.exitBps,
  }))
}

export function resolveTokenAddress(
  chainId: number,
  symbol: string
): Address | null {
  return chainTokenAddress(chainId, symbol.toUpperCase())
}

export function buildOnChainIntent(params: {
  agentId: bigint
  vault: Address
  symbol: string
  chainId: number
  usdcAmountHuman: string
  usdcDecimals: number
  minTokenOut: string
  maxSlippageBps: number
  exits: ExitRuleInput[]
  deadline: bigint
  nonce: bigint
}): OnChainPositionIntent {
  const token = resolveTokenAddress(params.chainId, params.symbol)
  if (!token) {
    throw new Error(`Unknown or unmapped token symbol: ${params.symbol}`)
  }

  return {
    agentId: params.agentId,
    vault: params.vault,
    token,
    usdcAmount: parseHumanAmount(params.usdcAmountHuman, params.usdcDecimals),
    minTokenOut: BigInt(params.minTokenOut),
    maxSlippageBps: params.maxSlippageBps,
    exits: mapExitRules(params.exits),
    deadline: params.deadline,
    nonce: params.nonce,
  }
}
