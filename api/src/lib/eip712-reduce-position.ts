import { verifyTypedData } from 'viem'
import type { Address, Hex } from 'viem'

export interface OnChainReducePositionIntent {
  agentId: bigint
  positionId: bigint
  exitBps: number
  deadline: bigint
  nonce: bigint
}

export async function verifyReducePositionSignature(params: {
  domain: { name: string; version: string }
  chainId: number
  verifyingContract: Address
  expectedSigner: Address
  intent: OnChainReducePositionIntent
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
      ReducePosition: [
        { name: 'agentId', type: 'uint256' },
        { name: 'positionId', type: 'uint256' },
        { name: 'exitBps', type: 'uint16' },
        { name: 'deadline', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
      ],
    },
    primaryType: 'ReducePosition',
    message: {
      agentId: intent.agentId,
      positionId: intent.positionId,
      exitBps: intent.exitBps,
      deadline: intent.deadline,
      nonce: intent.nonce,
    },
    signature,
  })
}
