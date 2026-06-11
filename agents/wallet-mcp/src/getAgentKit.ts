import type { AgentKit } from '@coinbase/agentkit'
import { extendAgentKitForArbitrumX402 } from './agentkit/extendArbitrumX402.js'
import { createAgentKitWithCdp } from './wallets/cdp.js'
import { createAgentKitWithViem } from './wallets/viem.js'

export type WalletProviderKind = 'viem' | 'cdp'

export function getWalletProviderKind(): WalletProviderKind {
  const raw = (process.env.WALLET_PROVIDER ?? 'viem').toLowerCase()
  if (raw === 'viem' || raw === 'cdp') {
    return raw
  }
  throw new Error(
    `WALLET_PROVIDER must be "viem" or "cdp", got: ${process.env.WALLET_PROVIDER}`
  )
}

export async function getAgentKit(): Promise<AgentKit> {
  extendAgentKitForArbitrumX402()

  switch (getWalletProviderKind()) {
    case 'viem':
      return createAgentKitWithViem()
    case 'cdp':
      return createAgentKitWithCdp()
  }
}
