import { contracts } from '../../constants/contracts.js'
import type { ChainContracts } from '../../constants/contracts.js'
import { parseAddress, parsePrivateKey } from '../evm/utils.js'

export interface TradingConfig {
  chainId: number
  rpcUrl: string
  chainContracts: ChainContracts
  tradeRouterAddress: `0x${string}`
  /** Explicit lens override; when unset, resolved from chainContracts or TradeRouter.lens(). */
  tradeRouterLensAddress: `0x${string}` | null
  agentRegistryAddress: `0x${string}`
  allocationManagerAddress: `0x${string}`
  executorPrivateKey: `0x${string}` | null
  usdcDecimals: number
  /** Lower bound for trade-activity log scans (env override or chain deploy block). */
  tradingLogFromBlock: bigint | null
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

  const tradeRouterLensAddress =
    parseAddress(env.TRADE_ROUTER_LENS_ADDRESS) ??
    chainContracts.TradeRouterLens ??
    null

  const tradingLogFromBlock = env.TRADING_LOG_FROM_BLOCK
    ? BigInt(env.TRADING_LOG_FROM_BLOCK)
    : (chainContracts.tradingLogFromBlock ?? null)

  return {
    chainId,
    rpcUrl: requireEnv(env, 'RPC_URL'),
    chainContracts,
    tradeRouterAddress,
    tradeRouterLensAddress,
    agentRegistryAddress: chainContracts.AgentRegistry,
    allocationManagerAddress: chainContracts.AllocationManager,
    executorPrivateKey: parsePrivateKey(env.EXECUTOR_PRIVATE_KEY),
    usdcDecimals: chainContracts.vaultAsset.decimals,
    tradingLogFromBlock,
  }
}
