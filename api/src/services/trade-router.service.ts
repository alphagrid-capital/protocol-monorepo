import { decodeEventLog } from 'viem'
import type { Address, Hex } from 'viem'
import type { OnChainAddToPositionIntent } from '../lib/eip712-add-position.js'
import type { OnChainReducePositionIntent } from '../lib/eip712-reduce-position.js'
import type { OnChainUpdateExitLadderIntent } from '../lib/eip712-update-exit-ladder.js'
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

  async dailyRealizedPnlUsdc(agentId: bigint, day: bigint): Promise<bigint> {
    const client = this.providerService.createPublicClient()
    return client.readContract({
      address: this.config.tradeRouterAddress,
      abi: tradeRouterAbi,
      functionName: 'dailyRealizedPnlUsdc',
      args: [agentId, day],
    })
  }

  private async writeAndWait(
    functionName:
      | 'openPosition'
      | 'addToPosition'
      | 'reducePosition'
      | 'updateExitLadder',
    args: readonly unknown[]
  ): Promise<Hex> {
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
      functionName,
      args: args as never,
    })

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: transactionHash,
    })
    if (receipt.status !== 'success') {
      throw new Error(`${functionName} transaction reverted`)
    }

    return transactionHash
  }

  async openPosition(
    intent: OnChainPositionIntent,
    signature: Hex
  ): Promise<{ positionId: string; transactionHash: Hex }> {
    const transactionHash = await this.writeAndWait('openPosition', [
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
    ])

    const positionId = await this.decodePositionIdFromReceipt(
      transactionHash,
      'PositionOpenedFromIntent'
    )

    return { positionId: positionId.toString(), transactionHash }
  }

  async addToPosition(
    intent: OnChainAddToPositionIntent,
    signature: Hex
  ): Promise<{ transactionHash: Hex }> {
    const transactionHash = await this.writeAndWait('addToPosition', [
      {
        agentId: intent.agentId,
        positionId: intent.positionId,
        usdcAmount: intent.usdcAmount,
        minTokenOut: intent.minTokenOut,
        maxSlippageBps: intent.maxSlippageBps,
        deadline: intent.deadline,
        nonce: intent.nonce,
      },
      signature,
    ])
    return { transactionHash }
  }

  async reducePosition(
    intent: OnChainReducePositionIntent,
    signature: Hex
  ): Promise<{ transactionHash: Hex }> {
    const transactionHash = await this.writeAndWait('reducePosition', [
      {
        agentId: intent.agentId,
        positionId: intent.positionId,
        exitBps: intent.exitBps,
        deadline: intent.deadline,
        nonce: intent.nonce,
      },
      signature,
    ])
    return { transactionHash }
  }

  async updateExitLadder(
    intent: OnChainUpdateExitLadderIntent,
    signature: Hex
  ): Promise<{ transactionHash: Hex }> {
    const transactionHash = await this.writeAndWait('updateExitLadder', [
      {
        agentId: intent.agentId,
        positionId: intent.positionId,
        exits: intent.exits.map((rule) => ({
          triggerType: rule.triggerType,
          triggerBps: rule.triggerBps,
          exitBps: rule.exitBps,
        })),
        deadline: intent.deadline,
        nonce: intent.nonce,
      },
      signature,
    ])
    return { transactionHash }
  }

  private async decodePositionIdFromReceipt(
    transactionHash: Hex,
    eventName: 'PositionOpenedFromIntent'
  ): Promise<bigint> {
    const publicClient = this.providerService.createPublicClient()
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: transactionHash,
    })

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
        if (decoded.eventName === eventName) {
          return decoded.args.positionId
        }
      } catch {
        // unrelated log
      }
    }

    throw new Error(`${eventName} event not found in receipt`)
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

  async getExitRules(positionId: bigint) {
    const positionManager = await this.getPositionManagerAddress()
    const client = this.providerService.createPublicClient()
    return client.readContract({
      address: positionManager,
      abi: positionManagerAbi,
      functionName: 'getExitRules',
      args: [positionId],
    })
  }
}
