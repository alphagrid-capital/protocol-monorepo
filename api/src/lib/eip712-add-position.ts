import { verifyTypedData } from 'viem'
import type { Address, Hex } from 'viem'

export interface OnChainAddToPositionIntent {
  agentId: bigint
  positionId: bigint
  usdcAmount: bigint
  minTokenOut: bigint
  maxSlippageBps: number
  deadline: bigint
  nonce: bigint
}

export async function verifyAddToPositionSignature(params: {
  domain: { name: string; version: string }
  chainId: number
  verifyingContract: Address
  expectedSigner: Address
  intent: OnChainAddToPositionIntent
  signature: Hex
}): Promise<boolean> {
  const {
    domain,
    chainId,
    verifyingContract,
    expectedSigner,
    intent,
    signature,
  } = params

  return verifyTypedData({
    address: expectedSigner,
    domain: {
      name: domain.name,
      version: domain.version,
      chainId,
      verifyingContract,
    },
    types: {
      AddToPosition: [
        { name: 'agentId', type: 'uint256' },
        { name: 'positionId', type: 'uint256' },
        { name: 'usdcAmount', type: 'uint256' },
        { name: 'minTokenOut', type: 'uint256' },
        { name: 'maxSlippageBps', type: 'uint16' },
        { name: 'deadline', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
      ],
    },
    primaryType: 'AddToPosition',
    message: {
      agentId: intent.agentId,
      positionId: intent.positionId,
      usdcAmount: intent.usdcAmount,
      minTokenOut: intent.minTokenOut,
      maxSlippageBps: intent.maxSlippageBps,
      deadline: intent.deadline,
      nonce: intent.nonce,
    },
    signature,
  })
}
