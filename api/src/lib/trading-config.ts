import { contracts } from '../constants/contracts.js'
import type { ChainContracts } from '../constants/contracts.js'
import { parseAddress, parsePrivateKey } from './evm-uilts.js'

export interface TradingConfig {
  chainId: number
  rpcUrl: string
  chainContracts: ChainContracts
  tradeRouterAddress: `0x${string}`
  agentRegistryAddress: `0x${string}`
  allocationManagerAddress: `0x${string}`
  executorPrivateKey: `0x${string}` | null
  usdcDecimals: number
}

function requireEnv(
  env: Record<string, string | undefined>,
  key: 'CHAIN_ID' | 'RPC_URL'
): string {
  const value = env[key]
  if (!value) {
    throw new Error(`${key} is not configured`)
  }
  return value
}

export function loadTradingConfig(
  env: Record<string, string | undefined> = {}
): TradingConfig {
  const chainId = Number(requireEnv(env, 'CHAIN_ID'))
  const chainContracts = contracts[chainId]
  if (!chainContracts) {
    throw new Error(`Unsupported CHAIN_ID: ${chainId}`)
  }
  if (!chainContracts.AgentRegistry) {
    throw new Error(`AgentRegistry is not deployed for CHAIN_ID: ${chainId}`)
  }
  if (!chainContracts.AllocationManager) {
    throw new Error(
      `AllocationManager is not deployed for CHAIN_ID: ${chainId}`
    )
  }

  const tradeRouterAddress =
    parseAddress(env.TRADE_ROUTER_ADDRESS) ?? chainContracts.TradeRouter
  if (!tradeRouterAddress) {
    throw new Error(
      'TRADE_ROUTER_ADDRESS is not configured (set env var or contracts.ts)'
    )
  }

  return {
    chainId,
    rpcUrl: requireEnv(env, 'RPC_URL'),
    chainContracts,
    tradeRouterAddress,
    agentRegistryAddress: chainContracts.AgentRegistry,
    allocationManagerAddress: chainContracts.AllocationManager,
    executorPrivateKey: parsePrivateKey(env.EXECUTOR_PRIVATE_KEY),
    usdcDecimals: chainContracts.usdc.decimals,
  }
}
