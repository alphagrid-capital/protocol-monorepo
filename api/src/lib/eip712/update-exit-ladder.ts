import { verifyTypedData } from 'viem'
import type { Address, Hex } from 'viem'
import { hashExitRules } from '../eip712/open-position.js'
import type { OnChainExitRule } from '../trading/intent-builder.js'

export interface OnChainUpdateExitLadderIntent {
  agentId: bigint
  positionId: bigint
  exits: OnChainExitRule[]
  deadline: bigint
  nonce: bigint
}

export async function verifyUpdateExitLadderSignature(params: {
  domain: { name: string; version: string }
  chainId: number
  verifyingContract: Address
  expectedSigner: Address
  intent: OnChainUpdateExitLadderIntent
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
  const exitsHash = hashExitRules(intent.exits)

  return verifyTypedData({
    address: expectedSigner,
    domain: {
      name: domain.name,
      version: domain.version,
      chainId,
      verifyingContract,
    },
    types: {
      UpdateExitLadder: [
        { name: 'agentId', type: 'uint256' },
        { name: 'positionId', type: 'uint256' },
        { name: 'exitsHash', type: 'bytes32' },
        { name: 'deadline', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
      ],
    },
    primaryType: 'UpdateExitLadder',
    message: {
      agentId: intent.agentId,
      positionId: intent.positionId,
      exitsHash,
      deadline: intent.deadline,
      nonce: intent.nonce,
    },
    signature,
  })
}
