import type { Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

export function getSigningAccount() {
  const privateKey = process.env.PRIVATE_KEY as Hex | undefined
  if (!privateKey) {
    throw new Error(
      'Alphagrid EIP-712 signing requires WALLET_PROVIDER=viem with PRIVATE_KEY in MCP env'
    )
  }
  return privateKeyToAccount(privateKey)
}
