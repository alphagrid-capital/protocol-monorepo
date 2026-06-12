import type { Address } from 'viem'
import {
  hashExitRules,
  parseHumanUsdcAmount,
  type ExitInput,
} from './eip712-exits.js'
import { getSigningAccount } from './signing-account.js'

export { hashExitRules, type ExitInput } from './eip712-exits.js'

export const SIGN_OPEN_POSITION_TOOL = {
  name: 'AlphagridActionProvider_sign_open_position',
  description:
    'Sign AlphaGrid TradeRouter OpenPosition EIP-712 typed data for a new trade intent.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string' },
      vault: { type: 'string' },
      token: { type: 'string' },
      usdcAmount: {
        type: 'string',
        description: 'Human USDC amount e.g. "300"',
      },
      minTokenOut: { type: 'string', default: '0' },
      maxSlippageBps: { type: 'number', default: 100 },
      exits: { type: 'array' },
      tradeRouter: { type: 'string' },
      chainId: { type: 'number' },
      nonce: { type: 'string' },
      deadline: { type: 'string' },
    },
    required: [
      'agentId',
      'vault',
      'token',
      'usdcAmount',
      'exits',
      'tradeRouter',
      'chainId',
      'nonce',
      'deadline',
    ],
  },
}

export async function handleSignOpenPosition(
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const account = getSigningAccount()
  const exits = args.exits as ExitInput[]
  const exitsHash = hashExitRules(exits)
  const usdcAmount = parseHumanUsdcAmount(args.usdcAmount as string)
  const deadline = BigInt(args.deadline as string)
  const nonce = BigInt(args.nonce as string)
  const agentId = BigInt(args.agentId as string)
  const tradeRouter = args.tradeRouter as Address

  const signature = await account.signTypedData({
    domain: {
      name: 'AlphaGrid TradeRouter',
      version: '1',
      chainId: args.chainId as number,
      verifyingContract: tradeRouter,
    },
    types: {
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
    },
    primaryType: 'OpenPosition',
    message: {
      agentId,
      vault: args.vault as Address,
      token: args.token as Address,
      usdcAmount,
      minTokenOut: BigInt((args.minTokenOut as string | undefined) ?? '0'),
      maxSlippageBps: (args.maxSlippageBps as number | undefined) ?? 100,
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
