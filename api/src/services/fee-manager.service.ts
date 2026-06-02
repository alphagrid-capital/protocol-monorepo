import type { Address } from 'viem'
import type { AgentRegistrationConfig } from '../lib/agent-registration-config.js'
import { atomicUsdcToUsdString } from '../lib/token-utils.js'
import { feeManagerAbi } from './abis/fee-manager.js'
import { ProviderService } from './provider.service.js'

export interface RegistrationFeeState {
  amount: bigint
  treasury: `0x${string}` | null
}
export type RegistrationFeeDetails = RegistrationFeeState & {
  displayUsd: string
}

export class FeeManagerService {
  constructor(
    private readonly providerService: ProviderService,
    private readonly feeManagerAddress: Address
  ) {}

  async getRegistrationFeeState(): Promise<RegistrationFeeState> {
    const client = this.providerService.createPublicClient()
    const [amount, treasury] = await Promise.all([
      client.readContract({
        address: this.feeManagerAddress,
        abi: feeManagerAbi,
        functionName: 'getRegistrationFee',
      }),
      client.readContract({
        address: this.feeManagerAddress,
        abi: feeManagerAbi,
        functionName: 'treasury',
      }),
    ])
    return { amount, treasury }
  }
}

export class RegistrationFeeService {
  constructor(private readonly config: AgentRegistrationConfig) {}

  async getState(): Promise<RegistrationFeeState> {
    if (
      this.config.mode !== 'live' ||
      !this.config.feeManager ||
      !this.config.rpcUrl
    ) {
      return { amount: 0n, treasury: null }
    }
    const providerService = ProviderService.fromConfig(this.config)
    return new FeeManagerService(
      providerService,
      this.config.feeManager
    ).getRegistrationFeeState()
  }

  async getDetails(): Promise<RegistrationFeeDetails> {
    const state = await this.getState()
    return {
      ...state,
      displayUsd: atomicUsdcToUsdString(state.amount),
    }
  }

  async getAtomic(): Promise<bigint> {
    const state = await this.getState()
    return state.amount
  }

  async getUsd(): Promise<string> {
    const state = await this.getState()
    return atomicUsdcToUsdString(state.amount)
  }
}
