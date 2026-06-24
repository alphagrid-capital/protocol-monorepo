import type { Address, PublicClient } from 'viem'
import type { AgentRegistrationConfig } from '../lib/agent/registration-config.js'
import { atomicUsdcToUsdString } from '../lib/tokens/utils.js'
import { feeManagerAbi } from './abis/fee-manager.js'
import { ProviderService } from './provider.service.js'

export interface RegistrationFeeDetails {
  amount: bigint
  treasury: `0x${string}` | null
  feeAsset: `0x${string}`
  displayUsd: string
}

export class FeeManagerService {
  private readonly publicClient: PublicClient
  private readonly feeManagerAddress: Address

  constructor(config: AgentRegistrationConfig) {
    const providerService = ProviderService.fromConfig(config)
    this.publicClient = providerService.createPublicClient()
    this.feeManagerAddress = config.feeManagerAddress
  }

  async getRegistrationFee(): Promise<RegistrationFeeDetails> {
    const [amount, treasury, feeAsset] = await Promise.all([
      this.publicClient.readContract({
        address: this.feeManagerAddress,
        abi: feeManagerAbi,
        functionName: 'getRegistrationFee',
      }),
      this.publicClient.readContract({
        address: this.feeManagerAddress,
        abi: feeManagerAbi,
        functionName: 'treasury',
      }),
      this.publicClient.readContract({
        address: this.feeManagerAddress,
        abi: feeManagerAbi,
        functionName: 'feeAsset',
      }),
    ])

    return {
      amount,
      treasury,
      feeAsset,
      displayUsd: atomicUsdcToUsdString(amount),
    }
  }
}
