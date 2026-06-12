import type { Address } from 'viem'
import { parseHumanUsdcAmount } from './eip712-exits.js'
import { getSigningAccount } from './signing-account.js'

export const SIGN_ADD_POSITION_TOOL = {
  name: 'AlphagridActionProvider_sign_add_position',
  description: 'Sign AlphaGrid TradeRouter AddToPosition EIP-712 typed data.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string' },
      positionId: { type: 'string' },
      usdcAmount: {
        type: 'string',
        description: 'Human USDC amount e.g. "150"',
      },
      minTokenOut: { type: 'string', default: '0' },
      maxSlippageBps: { type: 'number', default: 100 },
      tradeRouter: { type: 'string' },
      chainId: { type: 'number' },
      nonce: { type: 'string' },
      deadline: { type: 'string' },
    },
    required: [
      'agentId',
      'positionId',
      'usdcAmount',
      'tradeRouter',
      'chainId',
      'nonce',
      'deadline',
    ],
  },
}

export async function handleSignAddPosition(
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
      agentId: BigInt(args.agentId as string),
      positionId: BigInt(args.positionId as string),
      usdcAmount: parseHumanUsdcAmount(args.usdcAmount as string),
      minTokenOut: BigInt((args.minTokenOut as string | undefined) ?? '0'),
      maxSlippageBps: (args.maxSlippageBps as number | undefined) ?? 100,
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
