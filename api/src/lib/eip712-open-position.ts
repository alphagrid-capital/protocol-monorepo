import {
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
  verifyTypedData,
} from 'viem'
import type { Address, Hex } from 'viem'
import type {
  OnChainExitRule,
  OnChainPositionIntent,
} from './trading-intent-builder.js'

export function hashExitRules(exits: OnChainExitRule[]): Hex {
  const ruleHashes = exits.map((rule) =>
    keccak256(
      encodeAbiParameters(parseAbiParameters('uint8, int256, uint16'), [
        rule.triggerType,
        rule.triggerBps,
        rule.exitBps,
      ])
    )
  )
  return keccak256(
    encodeAbiParameters(parseAbiParameters('bytes32[]'), [ruleHashes])
  )
}

export const OPEN_POSITION_TYPES = {
  OpenPosition: [
    { name: 'agentId', type: 'uint256' },
    { name: 'vault', type: 'address' },
    { name: 'token', type: 'address' },
    { name: 'usdcAmount', type: 'uint256' },
    { name: 'minTokenOut', type: 'uint256' },
    { name: 'maxSlippageBps', type: 'uint16' },
    { name: 'exitsHash', type: 'bytes32' },
    { name: 'deadline', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const

export async function verifyOpenPositionSignature(params: {
  domain: { name: string; version: string }
  chainId: number
  verifyingContract: Address
  expectedSigner: Address
  intent: OnChainPositionIntent
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
    types: OPEN_POSITION_TYPES,
    primaryType: 'OpenPosition',
    message: {
      agentId: intent.agentId,
      vault: intent.vault,
      token: intent.token,
      usdcAmount: intent.usdcAmount,
      minTokenOut: intent.minTokenOut,
      maxSlippageBps: intent.maxSlippageBps,
      exitsHash,
      deadline: intent.deadline,
      nonce: intent.nonce,
    },
    signature,
  })
}
