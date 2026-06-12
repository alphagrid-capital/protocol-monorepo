import type { Address } from 'viem'
import { hashExitRules, type ExitInput } from './eip712-exits.js'
import { getSigningAccount } from './signing-account.js'

export const SIGN_UPDATE_EXIT_LADDER_TOOL = {
  name: 'AlphagridActionProvider_sign_update_exit_ladder',
  description:
    'Sign AlphaGrid TradeRouter UpdateExitLadder EIP-712 typed data.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string' },
      positionId: { type: 'string' },
      exits: { type: 'array' },
      tradeRouter: { type: 'string' },
      chainId: { type: 'number' },
      nonce: { type: 'string' },
      deadline: { type: 'string' },
    },
    required: [
      'agentId',
      'positionId',
      'exits',
      'tradeRouter',
      'chainId',
      'nonce',
      'deadline',
    ],
  },
}

export async function handleSignUpdateExitLadder(
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const account = getSigningAccount()
  const tradeRouter = args.tradeRouter as Address
  const deadline = BigInt(args.deadline as string)
  const nonce = BigInt(args.nonce as string)
  const exits = args.exits as ExitInput[]
  const exitsHash = hashExitRules(exits)

  const signature = await account.signTypedData({
    domain: {
      name: 'AlphaGrid TradeRouter',
      version: '1',
      chainId: args.chainId as number,
      verifyingContract: tradeRouter,
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
      agentId: BigInt(args.agentId as string),
      positionId: BigInt(args.positionId as string),
      exitsHash,
      deadline,
      nonce,
    },
  })

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            signer: account.address,
            signature,
            deadline: deadline.toString(),
            nonce: nonce.toString(),
            exitsHash,
          },
          null,
          2
        ),
      },
    ],
  }
}
