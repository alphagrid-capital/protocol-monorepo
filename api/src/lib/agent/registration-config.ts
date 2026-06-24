import type { Network } from '@x402/core/types'
import { contracts } from '../../constants/contracts.js'
import { parsePrivateKey } from '../evm/utils.js'

export interface AgentRegistrationConfig {
  agentRegistryAddress: `0x${string}`
  feeManagerAddress: `0x${string}`
  chainId: number
  rpcUrl: string
  relayerPrivateKey: `0x${string}` | null
  registrationFee: {
    assetAddress: `0x${string}`
    assetSymbol: string
    assetName: string
    decimals: number
  }
  x402: {
    networkName: string
    network: Network
    facilitatorUrl: string
  }
}

function requireEnv(
  env: Record<string, string | undefined>,
  key: 'CHAIN_ID' | 'RPC_URL' | 'X402_NETWORK' | 'X402_FACILITATOR_URL'
): string {
  const value = env[key]
  if (!value) {
    throw new Error(`${key} is not configured`)
  }
  return value
}

export function loadAgentRegistrationConfig(
  env: Record<string, string | undefined> = {}
): AgentRegistrationConfig {
  const chainId = Number(requireEnv(env, 'CHAIN_ID'))
  const chainContracts = contracts[chainId]
  if (!chainContracts) {
    throw new Error(`Unsupported CHAIN_ID: ${chainId}`)
  }
  if (!chainContracts.AgentRegistry) {
    throw new Error(`AgentRegistry is not deployed for CHAIN_ID: ${chainId}`)
  }
  if (!chainContracts.FeeManager) {
    throw new Error(`FeeManager is not deployed for CHAIN_ID: ${chainId}`)
  }

  return {
    agentRegistryAddress: chainContracts.AgentRegistry,
    feeManagerAddress: chainContracts.FeeManager,
    chainId,
    rpcUrl: requireEnv(env, 'RPC_URL'),
    relayerPrivateKey: parsePrivateKey(env.RELAYER_PRIVATE_KEY),
    registrationFee: {
      assetAddress: chainContracts.feeAsset.address,
      assetSymbol: chainContracts.feeAsset.symbol,
      assetName: chainContracts.feeAsset.name,
      decimals: chainContracts.feeAsset.decimals,
    },
    x402: {
      networkName: chainContracts.networkName,
      network: requireEnv(env, 'X402_NETWORK') as Network,
      facilitatorUrl: requireEnv(env, 'X402_FACILITATOR_URL'),
    },
  }
}
