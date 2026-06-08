import { decodeEventLog } from 'viem'
import type { Address, Hex } from 'viem'
import type { OnChainPositionIntent } from '../lib/trading-intent-builder.js'
import type { TradingConfig } from '../lib/trading-config.js'
import { positionManagerAbi } from './abis/position-manager.js'
import { tradeRouterAbi } from './abis/trade-router.js'
import type { ProviderService } from './provider.service.js'

export class TradeRouterService {
  constructor(
    private readonly providerService: ProviderService,
    private readonly config: TradingConfig
  ) {}

  async getEip712Domain(): Promise<{ name: string; version: string }> {
    const client = this.providerService.createPublicClient()
    const [, name, version] = await client.readContract({
      address: this.config.tradeRouterAddress,
      abi: tradeRouterAbi,
      functionName: 'eip712Domain',
    })
    return { name, version }
  }

  async getPositionManagerAddress(): Promise<Address> {
    const client = this.providerService.createPublicClient()
    return client.readContract({
      address: this.config.tradeRouterAddress,
      abi: tradeRouterAbi,
      functionName: 'positionManager',
    })
  }

  async nonces(agentId: bigint): Promise<bigint> {
    const client = this.providerService.createPublicClient()
    return client.readContract({
      address: this.config.tradeRouterAddress,
      abi: tradeRouterAbi,
      functionName: 'nonces',
      args: [agentId],
    })
  }

  async openPosition(
    intent: OnChainPositionIntent,
    signature: Hex
  ): Promise<{ positionId: string; transactionHash: Hex }> {
    if (!this.config.executorPrivateKey) {
      throw new Error('EXECUTOR_PRIVATE_KEY is not configured')
    }

    const publicClient = this.providerService.createPublicClient()
    const walletClient = this.providerService.createWalletClient(
      this.config.executorPrivateKey
    )

    const transactionHash = await walletClient.writeContract({
      address: this.config.tradeRouterAddress,
      abi: tradeRouterAbi,
      functionName: 'openPosition',
      args: [
        {
          agentId: intent.agentId,
          vault: intent.vault,
          token: intent.token,
          usdcAmount: intent.usdcAmount,
          minTokenOut: intent.minTokenOut,
          maxSlippageBps: intent.maxSlippageBps,
          exits: intent.exits.map((rule) => ({
            triggerType: rule.triggerType,
            triggerBps: rule.triggerBps,
            exitBps: rule.exitBps,
          })),
          deadline: intent.deadline,
          nonce: intent.nonce,
        },
        signature,
      ],
    })

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: transactionHash,
    })
    if (receipt.status !== 'success') {
      throw new Error('openPosition transaction reverted')
    }

    let positionId: bigint | null = null
    for (const log of receipt.logs) {
      if (
        log.address.toLowerCase() !==
        this.config.tradeRouterAddress.toLowerCase()
      ) {
        continue
      }
      try {
        const decoded = decodeEventLog({
          abi: tradeRouterAbi,
          data: log.data,
          topics: log.topics,
        })
        if (decoded.eventName === 'PositionOpenedFromIntent') {
          positionId = decoded.args.positionId
          break
        }
      } catch {
        // unrelated log
      }
    }

    if (positionId === null) {
      throw new Error('PositionOpenedFromIntent event not found in receipt')
    }

    return { positionId: positionId.toString(), transactionHash }
  }

  async openPositionId(agentId: bigint, token: Address): Promise<bigint> {
    const positionManager = await this.getPositionManagerAddress()
    const client = this.providerService.createPublicClient()
    return client.readContract({
      address: positionManager,
      abi: positionManagerAbi,
      functionName: 'openPositionId',
      args: [agentId, token],
    })
  }

  async getPosition(positionId: bigint) {
    const positionManager = await this.getPositionManagerAddress()
    const client = this.providerService.createPublicClient()
    return client.readContract({
      address: positionManager,
      abi: positionManagerAbi,
      functionName: 'getPosition',
      args: [positionId],
    })
  }
}
