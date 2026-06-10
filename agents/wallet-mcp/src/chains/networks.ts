import { NETWORK_ID_TO_VIEM_CHAIN } from '@coinbase/agentkit'
import type { Chain } from 'viem'
import { robinhoodTestnet } from './robinhoodTestnet.js'

const CUSTOM_NETWORK_ID_TO_VIEM_CHAIN = {
  'robinhood-testnet': robinhoodTestnet,
} satisfies Record<string, Chain>

export function getViemChainForNetworkId(networkId: string): Chain {
  if (networkId in CUSTOM_NETWORK_ID_TO_VIEM_CHAIN) {
    return CUSTOM_NETWORK_ID_TO_VIEM_CHAIN[
      networkId as keyof typeof CUSTOM_NETWORK_ID_TO_VIEM_CHAIN
    ]
  }

  const chain = NETWORK_ID_TO_VIEM_CHAIN[networkId]
  if (!chain) {
    const supported = [
      ...Object.keys(NETWORK_ID_TO_VIEM_CHAIN),
      ...Object.keys(CUSTOM_NETWORK_ID_TO_VIEM_CHAIN),
    ].sort()
    throw new Error(
      `Unsupported NETWORK_ID: ${networkId}. Supported: ${supported.join(', ')}`
    )
  }

  return chain as Chain
}
