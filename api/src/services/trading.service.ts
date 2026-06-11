import type { Address, Hex } from 'viem'
import { AppError } from '../errors.js'
import { verifyAddToPositionSignature } from '../lib/eip712-add-position.js'
import { verifyOpenPositionSignature } from '../lib/eip712-open-position.js'
import { verifyReducePositionSignature } from '../lib/eip712-reduce-position.js'
import { verifyUpdateExitLadderSignature } from '../lib/eip712-update-exit-ladder.js'
import { parseHumanAmount } from '../lib/amount-utils.js'
import {
  DEFAULT_EXIT_LADDER,
  buildOnChainIntent,
  mapExitRules,
  mapOnChainExitRule,
  resolveTokenAddress,
} from '../lib/trading-intent-builder.js'
import { loadTradingConfig, type TradingConfig } from '../lib/trading-config.js'
import { tokenCatalog } from '../lib/token-catalog.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import { isContractRevert } from '../lib/viem-revert.js'
import type {
  AddPositionRequest,
  ExitRuleInput,
  ListAgentPositionsResponse,
  OpenPositionRequest,
  ReducePositionRequest,
  SubmitAdjustIntentResponse,
  SubmitTradeIntentResponse,
  TradeIntentQuote,
  UpdateExitLadderRequest,
} from '../schemas/trading.js'
import { allocationManagerAbi } from './abis/allocation-manager.js'
import { mandateVaultAbi } from './abis/mandate-vault.js'
import { vaultTrackRegistryAbi } from './abis/vault-track-registry.js'
import {
  AgentNotFoundError,
  AgentRegistryService,
} from './agent-registry.service.js'
import { ProviderService } from './provider.service.js'
import { TradeRouterService } from './trade-router.service.js'

export const TRADING_NOT_IMPLEMENTED_MESSAGE =
  'Trading API is not yet available. Intent gateway and executor are planned for a future release.'

/** AgentRegistry AgentStatus.Active */
const AGENT_STATUS_ACTIVE = 1
/** IPositionTypes.PositionStatus.Open */
const POSITION_STATUS_OPEN = 0

export class TradingError extends AppError {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message, status)
    this.name = 'TradingError'
  }
}

export class TradingService {
  constructor(private readonly config: TradingConfig) {}

  static fromEnv(
    env: Record<string, string | undefined> = getWorkerEnv()
  ): TradingService {
    try {
      return new TradingService(loadTradingConfig(env))
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Trading is not configured'
      throw new TradingError(message, 503)
    }
  }

  static notImplemented() {
    return {
      error: 'Not implemented' as const,
      code: 'NOT_IMPLEMENTED' as const,
      message: TRADING_NOT_IMPLEMENTED_MESSAGE,
    }
  }

  private providerService(): ProviderService {
    return ProviderService.fromChain(this.config.rpcUrl, this.config.chainId)
  }

  private agentRegistryService(): AgentRegistryService {
    return new AgentRegistryService(
      this.providerService(),
      this.config.agentRegistryAddress
    )
  }

  private tradeRouterService(): TradeRouterService {
    return new TradeRouterService(this.providerService(), this.config)
  }

  async getQuote(
    agentIdStr: string,
    symbol?: string
  ): Promise<TradeIntentQuote> {
    const agentId = BigInt(agentIdStr)
    const registry = this.agentRegistryService()
    const tradeRouter = this.tradeRouterService()

    const agent = await registry.getAgent(agentId)
    const vault = agent.vault as Address
    const signer = agent.signer as Address
    const trackId = BigInt(agent.track)
    const day = BigInt(Math.floor(Date.now() / 1000 / 86400))
    const [
      nonce,
      eip712Domain,
      exitBounds,
      accountRiskBounds,
      dailyRealizedPnlUsdc,
    ] = await Promise.all([
      tradeRouter.nonces(agentId),
      tradeRouter.getEip712Domain(),
      this.getExitBounds(vault, trackId),
      this.getAccountRiskBounds(vault, trackId),
      tradeRouter.dailyRealizedPnlUsdc(agentId, day),
    ])
    const allocation = await this.getAllocation(agentId)
    const allowedSymbols = await this.listAllowedSymbols(vault)

    const available =
      allocation.cap > allocation.used ? allocation.cap - allocation.used : 0n

    let token: Address | null = null
    if (symbol) {
      token = resolveTokenAddress(this.config.chainId, symbol)
      if (!token) {
        throw new TradingError(`Unknown token symbol: ${symbol}`, 400)
      }
      await this.assertTokenAllowed(vault, token)
    }

    return {
      agentId: agentIdStr,
      vault,
      signer,
      nonce: nonce.toString(),
      allocation: {
        used: allocation.used.toString(),
        cap: allocation.cap.toString(),
        available: available.toString(),
      },
      allowedSymbols,
      trackId: Number(trackId),
      exitBounds,
      accountRiskBounds,
      dailyRealizedPnlUsdc: dailyRealizedPnlUsdc.toString(),
      defaultExit: DEFAULT_EXIT_LADDER,
      eip712: {
        domainName: eip712Domain.name,
        domainVersion: eip712Domain.version,
        chainId: this.config.chainId,
        verifyingContract: this.config.tradeRouterAddress,
        primaryType: 'OpenPosition',
      },
      tradeRouter: this.config.tradeRouterAddress,
      token: token ?? undefined,
    }
  }

  async submitIntent(
    agentIdStr: string,
    body: OpenPositionRequest
  ): Promise<SubmitTradeIntentResponse> {
    if (!this.config.executorPrivateKey) {
      throw new TradingError('EXECUTOR_PRIVATE_KEY is not configured', 503)
    }

    const agentId = BigInt(agentIdStr)
    const registry = this.agentRegistryService()
    const tradeRouter = this.tradeRouterService()

    let agent
    try {
      agent = await registry.getAgent(agentId)
    } catch (error) {
      if (error instanceof AgentNotFoundError) {
        throw new TradingError(error.message, 404)
      }
      throw error
    }

    if (agent.status !== AGENT_STATUS_ACTIVE) {
      throw new TradingError(`Agent ${agentIdStr} is not Active`, 400)
    }

    const vault = await registry.vaultOf(agentId)
    const token = resolveTokenAddress(this.config.chainId, body.symbol)
    if (!token) {
      throw new TradingError(`Unknown token symbol: ${body.symbol}`, 400)
    }
    await this.assertTokenAllowed(vault, token)

    const deadline = BigInt(body.deadline)
    const nonce = BigInt(body.nonce)
    const now = BigInt(Math.floor(Date.now() / 1000))
    if (deadline < now) {
      throw new TradingError('Trade intent deadline has expired', 400)
    }

    const onChainNonce = await tradeRouter.nonces(agentId)
    if (onChainNonce !== nonce) {
      throw new TradingError(
        `Invalid nonce: expected ${onChainNonce.toString()}, got ${body.nonce}`,
        400
      )
    }

    let intent
    try {
      intent = buildOnChainIntent({
        agentId,
        vault,
        symbol: body.symbol,
        chainId: this.config.chainId,
        usdcAmountHuman: body.usdcAmount,
        usdcDecimals: this.config.usdcDecimals,
        minTokenOut: body.minTokenOut,
        maxSlippageBps: body.maxSlippageBps,
        exits: body.exits,
        deadline,
        nonce,
      })
    } catch (error) {
      throw new TradingError(
        error instanceof Error ? error.message : 'Invalid trade intent',
        400
      )
    }

    const [signer, eip712Domain] = await Promise.all([
      registry.signerOf(agentId),
      tradeRouter.getEip712Domain(),
    ])
    const valid = await verifyOpenPositionSignature({
      domain: eip712Domain,
      chainId: this.config.chainId,
      verifyingContract: this.config.tradeRouterAddress,
      expectedSigner: signer,
      intent,
      signature: body.signature as Hex,
    })
    if (!valid) {
      throw new TradingError('Invalid OpenPosition signature', 400)
    }

    try {
      const result = await tradeRouter.openPosition(
        intent,
        body.signature as Hex
      )
      return {
        agentId: agentIdStr,
        positionId: result.positionId,
        transactionHash: result.transactionHash,
      }
    } catch (error) {
      throw this.mapSubmitError(error)
    }
  }

  async getAddQuote(agentIdStr: string, positionIdStr: string) {
    return this.buildPositionQuote(
      agentIdStr,
      positionIdStr,
      'AddToPosition',
      true
    )
  }

  async getReduceQuote(agentIdStr: string, positionIdStr: string) {
    return this.buildPositionQuote(
      agentIdStr,
      positionIdStr,
      'ReducePosition',
      false
    )
  }

  async getExitLadderQuote(agentIdStr: string, positionIdStr: string) {
    const base = await this.buildPositionQuote(
      agentIdStr,
      positionIdStr,
      'UpdateExitLadder',
      false
    )
    const exitRules = base.position.exitRules
    const nextRuleIndex = base.position.nextRuleIndex
    return {
      ...base,
      exitBounds: base.exitBounds!,
      currentRules: exitRules,
      pendingRules: exitRules.slice(nextRuleIndex),
      nextRuleIndex,
      eip712: { ...base.eip712, primaryType: 'UpdateExitLadder' as const },
    }
  }

  async submitAddIntent(
    agentIdStr: string,
    body: AddPositionRequest
  ): Promise<SubmitAdjustIntentResponse> {
    return this.submitAdjustIntent(agentIdStr, body, 'add')
  }

  async submitReduceIntent(
    agentIdStr: string,
    body: ReducePositionRequest
  ): Promise<SubmitAdjustIntentResponse> {
    return this.submitAdjustIntent(agentIdStr, body, 'reduce')
  }

  async submitExitLadderIntent(
    agentIdStr: string,
    body: UpdateExitLadderRequest
  ): Promise<SubmitAdjustIntentResponse> {
    return this.submitAdjustIntent(agentIdStr, body, 'updateExitLadder')
  }

  async listOpenPositions(
    agentIdStr: string
  ): Promise<ListAgentPositionsResponse> {
    const agentId = BigInt(agentIdStr)
    const registry = this.agentRegistryService()
    const tradeRouter = this.tradeRouterService()

    try {
      await registry.getAgent(agentId)
    } catch (error) {
      if (error instanceof AgentNotFoundError) {
        throw new TradingError(error.message, 404)
      }
      throw error
    }

    const chainTokens =
      tokenCatalog.chains[String(this.config.chainId)]?.tokens ?? {}
    const positions: ListAgentPositionsResponse['positions'] = []

    for (const [symbol, address] of Object.entries(chainTokens)) {
      if (!address) {
        continue
      }
      const token = address as Address
      const positionId = await tradeRouter.openPositionId(agentId, token)
      if (positionId === 0n) {
        continue
      }

      const position = await tradeRouter.getPosition(positionId)
      if (position.status !== POSITION_STATUS_OPEN) {
        continue
      }

      const exitRules = await tradeRouter.getExitRules(positionId)
      const mappedRules = exitRules.map(mapOnChainExitRule)

      positions.push({
        positionId: position.positionId.toString(),
        agentId: agentIdStr,
        symbol,
        token: position.token,
        vault: position.vault,
        tokenAmount: position.tokenAmount.toString(),
        entryPriceUsdc: position.entryPriceUsdc.toString(),
        usdcCostBasis: position.usdcCostBasis.toString(),
        maxSlippageBps: position.maxSlippageBps,
        status: 'Open',
        nextRuleIndex: position.nextRuleIndex,
        exitRules: mappedRules,
        pendingRules: mappedRules.slice(position.nextRuleIndex),
        openedAt: position.openedAt.toString(),
      })
    }

    return { agentId: agentIdStr, positions }
  }

  private async buildPositionQuote(
    agentIdStr: string,
    positionIdStr: string,
    primaryType: 'AddToPosition' | 'ReducePosition' | 'UpdateExitLadder',
    includeAllocation: boolean
  ) {
    const agentId = BigInt(agentIdStr)
    const positionId = BigInt(positionIdStr)
    const registry = this.agentRegistryService()
    const tradeRouter = this.tradeRouterService()

    const agent = await registry.getAgent(agentId)
    const signer = agent.signer
    const trackId = BigInt(agent.track)
    const [nonce, eip712Domain, position, exitRules] = await Promise.all([
      tradeRouter.nonces(agentId),
      tradeRouter.getEip712Domain(),
      tradeRouter.getPosition(positionId),
      tradeRouter.getExitRules(positionId),
    ])

    if (position.agentId !== agentId) {
      throw new TradingError(
        `Position ${positionIdStr} does not belong to agent ${agentIdStr}`,
        400
      )
    }
    if (position.status !== POSITION_STATUS_OPEN) {
      throw new TradingError(`Position ${positionIdStr} is not open`, 400)
    }

    const mappedRules = exitRules.map(mapOnChainExitRule)
    const symbol = this.symbolForToken(position.token as Address)
    const serialized = {
      positionId: position.positionId.toString(),
      agentId: agentIdStr,
      symbol,
      token: position.token,
      vault: position.vault,
      tokenAmount: position.tokenAmount.toString(),
      entryPriceUsdc: position.entryPriceUsdc.toString(),
      usdcCostBasis: position.usdcCostBasis.toString(),
      maxSlippageBps: position.maxSlippageBps,
      status: 'Open' as const,
      nextRuleIndex: position.nextRuleIndex,
      exitRules: mappedRules,
      pendingRules: mappedRules.slice(position.nextRuleIndex),
      openedAt: position.openedAt.toString(),
    }

    const exitBounds = await this.getExitBounds(
      position.vault as Address,
      trackId
    )

    const base = {
      agentId: agentIdStr,
      positionId: positionIdStr,
      signer,
      nonce: nonce.toString(),
      eip712: {
        domainName: eip712Domain.name,
        domainVersion: eip712Domain.version,
        chainId: this.config.chainId,
        verifyingContract: this.config.tradeRouterAddress,
        primaryType,
      },
      tradeRouter: this.config.tradeRouterAddress,
      position: serialized,
      exitBounds: includeAllocation ? undefined : exitBounds,
    }

    if (!includeAllocation) {
      return base
    }

    const allocation = await this.getAllocation(agentId)
    const available =
      allocation.cap > allocation.used ? allocation.cap - allocation.used : 0n

    return {
      ...base,
      exitBounds,
      allocation: {
        used: allocation.used.toString(),
        cap: allocation.cap.toString(),
        available: available.toString(),
      },
    }
  }

  private async submitAdjustIntent(
    agentIdStr: string,
    body: AddPositionRequest | ReducePositionRequest | UpdateExitLadderRequest,
    kind: 'add' | 'reduce' | 'updateExitLadder'
  ): Promise<SubmitAdjustIntentResponse> {
    if (!this.config.executorPrivateKey) {
      throw new TradingError('EXECUTOR_PRIVATE_KEY is not configured', 503)
    }

    const agentId = BigInt(agentIdStr)
    const positionId = BigInt(body.positionId)
    const registry = this.agentRegistryService()
    const tradeRouter = this.tradeRouterService()

    try {
      await registry.getAgent(agentId)
    } catch (error) {
      if (error instanceof AgentNotFoundError) {
        throw new TradingError(error.message, 404)
      }
      throw error
    }

    const agent = await registry.getAgent(agentId)
    if (agent.status !== AGENT_STATUS_ACTIVE) {
      throw new TradingError(`Agent ${agentIdStr} is not Active`, 400)
    }

    const position = await tradeRouter.getPosition(positionId)
    if (position.agentId !== agentId) {
      throw new TradingError(
        `Position ${body.positionId} does not belong to agent ${agentIdStr}`,
        400
      )
    }
    if (position.status !== POSITION_STATUS_OPEN) {
      throw new TradingError(`Position ${body.positionId} is not open`, 400)
    }

    const deadline = BigInt(body.deadline)
    const nonce = BigInt(body.nonce)
    await this.validateNonceDeadline(tradeRouter, agentId, nonce, deadline)

    const [signer, eip712Domain] = await Promise.all([
      registry.signerOf(agentId),
      tradeRouter.getEip712Domain(),
    ])

    try {
      if (kind === 'add') {
        const addBody = body as AddPositionRequest
        const intent = {
          agentId,
          positionId,
          usdcAmount: parseHumanAmount(
            addBody.usdcAmount,
            this.config.usdcDecimals
          ),
          minTokenOut: BigInt(addBody.minTokenOut),
          maxSlippageBps: addBody.maxSlippageBps,
          deadline,
          nonce,
        }
        const valid = await verifyAddToPositionSignature({
          domain: eip712Domain,
          chainId: this.config.chainId,
          verifyingContract: this.config.tradeRouterAddress,
          expectedSigner: signer,
          intent,
          signature: addBody.signature as Hex,
        })
        if (!valid) {
          throw new TradingError('Invalid AddToPosition signature', 400)
        }
        const result = await tradeRouter.addToPosition(
          intent,
          addBody.signature as Hex
        )
        return {
          agentId: agentIdStr,
          positionId: body.positionId,
          transactionHash: result.transactionHash,
        }
      }

      if (kind === 'reduce') {
        const reduceBody = body as ReducePositionRequest
        const intent = {
          agentId,
          positionId,
          exitBps: reduceBody.exitBps,
          deadline,
          nonce,
        }
        const valid = await verifyReducePositionSignature({
          domain: eip712Domain,
          chainId: this.config.chainId,
          verifyingContract: this.config.tradeRouterAddress,
          expectedSigner: signer,
          intent,
          signature: reduceBody.signature as Hex,
        })
        if (!valid) {
          throw new TradingError('Invalid ReducePosition signature', 400)
        }
        const result = await tradeRouter.reducePosition(
          intent,
          reduceBody.signature as Hex
        )
        return {
          agentId: agentIdStr,
          positionId: body.positionId,
          transactionHash: result.transactionHash,
        }
      }

      const updateBody = body as UpdateExitLadderRequest
      const intent = {
        agentId,
        positionId,
        exits: mapExitRules(updateBody.exits),
        deadline,
        nonce,
      }
      const valid = await verifyUpdateExitLadderSignature({
        domain: eip712Domain,
        chainId: this.config.chainId,
        verifyingContract: this.config.tradeRouterAddress,
        expectedSigner: signer,
        intent,
        signature: updateBody.signature as Hex,
      })
      if (!valid) {
        throw new TradingError('Invalid UpdateExitLadder signature', 400)
      }
      const result = await tradeRouter.updateExitLadder(
        intent,
        updateBody.signature as Hex
      )
      return {
        agentId: agentIdStr,
        positionId: body.positionId,
        transactionHash: result.transactionHash,
      }
    } catch (error) {
      throw this.mapSubmitError(error)
    }
  }

  private async validateNonceDeadline(
    tradeRouter: TradeRouterService,
    agentId: bigint,
    nonce: bigint,
    deadline: bigint
  ) {
    const now = BigInt(Math.floor(Date.now() / 1000))
    if (deadline < now) {
      throw new TradingError('Trade intent deadline has expired', 400)
    }
    const onChainNonce = await tradeRouter.nonces(agentId)
    if (onChainNonce !== nonce) {
      throw new TradingError(
        `Invalid nonce: expected ${onChainNonce.toString()}, got ${nonce.toString()}`,
        400
      )
    }
  }

  private symbolForToken(token: Address): string {
    const chainTokens =
      tokenCatalog.chains[String(this.config.chainId)]?.tokens ?? {}
    for (const [symbol, address] of Object.entries(chainTokens)) {
      if (address?.toLowerCase() === token.toLowerCase()) {
        return symbol
      }
    }
    return token
  }

  private async getAccountRiskBounds(vault: Address, trackId: bigint) {
    const registryAddress = this.config.chainContracts.VaultTrackRegistry
    if (!registryAddress) {
      throw new TradingError('VaultTrackRegistry is not configured', 503)
    }

    const client = this.providerService().createPublicClient()
    const config = await client.readContract({
      address: registryAddress,
      abi: vaultTrackRegistryAbi,
      functionName: 'getVaultTrackConfig',
      args: [vault, trackId],
    })

    return {
      maxDailyLossBps: Number(config.maxDailyLossBps),
      maxDrawdownBps: Number(config.maxDrawdownBps),
    }
  }

  private async getExitBounds(vault: Address, trackId: bigint) {
    const registryAddress = this.config.chainContracts.VaultTrackRegistry
    if (!registryAddress) {
      throw new TradingError('VaultTrackRegistry is not configured', 503)
    }

    const client = this.providerService().createPublicClient()
    const config = await client.readContract({
      address: registryAddress,
      abi: vaultTrackRegistryAbi,
      functionName: 'getVaultTrackConfig',
      args: [vault, trackId],
    })

    return {
      maxStopLossBps: Number(config.maxStopLossBps),
      minTakeProfitBps: Number(config.minTakeProfitBps),
      maxTakeProfitBps: Number(config.maxTakeProfitBps),
      requireStopLoss: config.requireStopLoss,
      requireTakeProfit: config.requireTakeProfit,
    }
  }

  private async getAllocation(agentId: bigint) {
    const client = this.providerService().createPublicClient()
    return client.readContract({
      address: this.config.allocationManagerAddress,
      abi: allocationManagerAbi,
      functionName: 'getAllocation',
      args: [agentId],
    })
  }

  private async listAllowedSymbols(vault: Address): Promise<string[]> {
    const chainTokens =
      tokenCatalog.chains[String(this.config.chainId)]?.tokens ?? {}
    const allowed: string[] = []

    for (const [symbol, address] of Object.entries(chainTokens)) {
      if (!address) {
        continue
      }
      try {
        const isAllowed = await this.providerService()
          .createPublicClient()
          .readContract({
            address: vault,
            abi: mandateVaultAbi,
            functionName: 'isAllowedToken',
            args: [address as Address],
          })
        if (isAllowed) {
          allowed.push(symbol)
        }
      } catch {
        // skip unreachable vault/token pairs
      }
    }

    return allowed.sort()
  }

  private async assertTokenAllowed(vault: Address, token: Address) {
    const client = this.providerService().createPublicClient()
    const isAllowed = await client.readContract({
      address: vault,
      abi: mandateVaultAbi,
      functionName: 'isAllowedToken',
      args: [token],
    })
    if (!isAllowed) {
      throw new TradingError(
        `Token is not allowed on agent vault: ${token}`,
        400
      )
    }
  }

  private mapSubmitError(error: unknown): TradingError {
    if (error instanceof TradingError) {
      return error
    }

    const revertNames = [
      'InvalidSignature',
      'InvalidNonce',
      'ExpiredDeadline',
      'InvalidExitRules',
      'ExitRulesOutOfBounds',
      'AgentNotTradable',
      'VaultMismatch',
      'TokenNotAllowed',
      'PositionAlreadyOpen',
      'PositionNotOpen',
      'PositionAgentMismatch',
      'InvalidReduceAmount',
      'TooManyExitRules',
      'PendingRuleAlreadyTriggered',
      'AllocationNotActive',
      'ExceedsAllocationCap',
      'ExceedsMaxTradeSize',
      'ExceedsDailyTurnover',
      'ExceedsDailyLoss',
      'VaultTrackNotActive',
    ] as const

    for (const name of revertNames) {
      if (isContractRevert(error, name)) {
        return new TradingError(`On-chain revert: ${name}`, 400)
      }
    }

    if (isContractRevert(error, 'RegistryPaused')) {
      return new TradingError('AgentRegistry is paused', 503)
    }
    if (isContractRevert(error, 'TradingOperationsPaused')) {
      return new TradingError('Vault trading is paused', 503)
    }

    const message =
      error instanceof Error ? error.message : 'Trade submission failed'
    if (message.includes('reverted') || message.includes('Revert')) {
      return new TradingError(message, 502)
    }
    if (message.includes('not configured')) {
      return new TradingError(message, 503)
    }
    return new TradingError(message, 502)
  }
}
