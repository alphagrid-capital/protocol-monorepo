import { createRequire } from 'node:module'
import path from 'node:path'

/** AlphaGrid Arbitrum Sepolia x402 fee USDC (api/src/constants/contracts.ts chain 421614 feeAsset). */
const ARBITRUM_SEPOLIA_USDC = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d'

const ARBITRUM_X402_NETWORKS = {
  'arbitrum-sepolia': ['arbitrum-sepolia', 'eip155:421614'],
  'arbitrum-mainnet': ['arbitrum', 'eip155:42161'],
} as const

const require = createRequire(import.meta.url)

function loadAgentKitConstants<T>(relativePath: string): T {
  const agentkitRoot = path.dirname(
    path.dirname(require.resolve('@coinbase/agentkit'))
  )
  return require(path.join(agentkitRoot, relativePath)) as T
}

let extended = false

/**
 * AgentKit's stock X402ActionProvider only enables x402 on Base + Solana.
 * AlphaGrid registration uses eip155:421614 / eip155:42161 — patch before AgentKit starts.
 */
export function extendAgentKitForArbitrumX402(): void {
  if (extended) {
    return
  }
  extended = true

  const { SUPPORTED_NETWORKS, NETWORK_MAPPINGS } = loadAgentKitConstants<{
    SUPPORTED_NETWORKS: string[]
    NETWORK_MAPPINGS: Record<string, string[]>
  }>('dist/action-providers/x402/constants.js')

  for (const networkId of Object.keys(ARBITRUM_X402_NETWORKS)) {
    if (!SUPPORTED_NETWORKS.includes(networkId)) {
      SUPPORTED_NETWORKS.push(networkId)
    }
  }

  Object.assign(NETWORK_MAPPINGS, ARBITRUM_X402_NETWORKS)

  const { TOKEN_ADDRESSES_BY_SYMBOLS } = loadAgentKitConstants<{
    TOKEN_ADDRESSES_BY_SYMBOLS: Record<string, Record<string, string>>
  }>('dist/action-providers/erc20/constants.js')

  TOKEN_ADDRESSES_BY_SYMBOLS['arbitrum-sepolia'] = {
    ...TOKEN_ADDRESSES_BY_SYMBOLS['arbitrum-sepolia'],
    USDC: ARBITRUM_SEPOLIA_USDC,
  }
}
