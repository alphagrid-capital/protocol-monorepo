import type { Address } from 'viem'
import { getSigningAccount } from './signing-account.js'

export const SIGN_REDUCE_POSITION_TOOL = {
  name: 'AlphagridActionProvider_sign_reduce_position',
  description: 'Sign AlphaGrid TradeRouter ReducePosition EIP-712 typed data.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string' },
      positionId: { type: 'string' },
      exitBps: { type: 'number' },
      tradeRouter: { type: 'string' },
      chainId: { type: 'number' },
      nonce: { type: 'string' },
      deadline: { type: 'string' },
    },
    required: [
      'agentId',
      'positionId',
      'exitBps',
      'tradeRouter',
      'chainId',
      'nonce',
      'deadline',
    ],
  },
}

export async function handleSignReducePosition(
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const account = getSigningAccount()
  const tradeRouter = args.tradeRouter as Address
  const deadline = BigInt(args.deadline as string)
  const nonce = BigInt(args.nonce as string)

  const signature = await account.signTypedData({
    domain: {
      name: 'AlphaGrid TradeRouter',
      version: '1',
      chainId: args.chainId as number,
      verifyingContract: tradeRouter,
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
      agentId: BigInt(args.agentId as string),
      positionId: BigInt(args.positionId as string),
      exitBps: args.exitBps as number,
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
          },
          null,
          2
        ),
      },
    ],
  }
}
