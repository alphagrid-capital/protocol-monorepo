import { createPublicClient, createWalletClient, http } from 'viem'
import type { Chain, Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import * as viemChains from 'viem/chains'
import { robinhoodTestnet } from '../constants/chains/robinhoodTestnet.js'
import type { AgentRegistrationConfig } from '../lib/agent/registration-config.js'
import { getWorkerEnv } from '../lib/worker-env.js'

const SUPPORTED_CHAINS = [
  viemChains.baseSepolia,
  viemChains.arbitrum,
  viemChains.arbitrumSepolia,
  robinhoodTestnet,
]

function resolveChain(chainId: number, rpcUrl: string): Chain {
  const supportedChain = SUPPORTED_CHAINS.find((chain) => chain.id === chainId)
  if (!supportedChain) {
    throw new Error(`Unsupported chain ID: ${chainId}`)
  }

  return {
    ...supportedChain,
    rpcUrls: {
      ...supportedChain.rpcUrls,
      default: { http: [rpcUrl] },
    },
  }
}

export class ProviderService {
  readonly chain: Chain

  constructor(
    private readonly rpcUrl: string,
    chainId: number
  ) {
    this.chain = resolveChain(chainId, rpcUrl)
  }

  static fromConfig(config: AgentRegistrationConfig): ProviderService {
    return new ProviderService(config.rpcUrl, config.chainId)
  }

  static fromChain(rpcUrl: string, chainId: number): ProviderService {
    return new ProviderService(rpcUrl, chainId)
  }

  createPublicClient() {
    return createPublicClient({
      chain: this.chain,
      transport: http(this.rpcUrl, {
        fetchOptions: this.rpcFetchOptions(),
      }),
    })
  }

  createWalletClient(privateKey: Hex) {
    return createWalletClient({
      account: privateKeyToAccount(privateKey),
      chain: this.chain,
      transport: http(this.rpcUrl, {
        fetchOptions: this.rpcFetchOptions(),
      }),
    })
  }

  private rpcFetchOptions() {
    const secretKey = getWorkerEnv().RPC_SECRET_KEY
    if (!secretKey) {
      return undefined
    }
    return { headers: { 'x-secret-key': secretKey } }
  }
}
