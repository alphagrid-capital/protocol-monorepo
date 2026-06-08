import {
  ActionProvider,
  AgentKit,
  cdpApiActionProvider,
  erc20ActionProvider,
  NETWORK_ID_TO_VIEM_CHAIN,
  pythActionProvider,
  ViemWalletProvider,
  walletActionProvider,
  wethActionProvider,
  x402ActionProvider,
} from '@coinbase/agentkit'
import { createWalletClient, Hex, http } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import type { Chain } from 'viem'

export async function createAgentKitWithViem(): Promise<AgentKit> {
  try {
    let privateKey = process.env.PRIVATE_KEY as Hex
    if (!privateKey) {
      privateKey = generatePrivateKey()
    }

    const account = privateKeyToAccount(privateKey)
    const networkId = process.env.NETWORK_ID as string

    const client = createWalletClient({
      account,
      chain: NETWORK_ID_TO_VIEM_CHAIN[networkId] as Chain,
      transport: http(),
    })

    const walletProvider = new ViemWalletProvider(client as any)

    const actionProviders: ActionProvider[] = [
      wethActionProvider(), // Un/Wrap ETH → WETH
      pythActionProvider(), // Get price from Pyth (by symbol, by feed ID)
      walletActionProvider(), // Get wallet balance, nonce, etc.
      erc20ActionProvider(), // Get ERC20 token balance, approve, transfer, etc.
    ]
    const canUseCdpApi =
      process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET
    if (canUseCdpApi) {
      actionProviders.push(
        cdpApiActionProvider(), // Get CDP API data (faucet, supported networks, etc.)
        x402ActionProvider() // Execute x402 payments
      )
    }

    return AgentKit.from({
      walletProvider, // Get address, network, native ETH/SOL balance, etc.
      actionProviders,
    })
  } catch (error) {
    console.error('Error initializing viem agent:', error)
    throw new Error('Failed to initialize viem agent')
  }
}
