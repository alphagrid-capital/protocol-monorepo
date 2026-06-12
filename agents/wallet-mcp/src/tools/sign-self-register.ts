import type { Address } from 'viem'
import { getSigningAccount } from './signing-account.js'

const SELF_REGISTER_TYPES = {
  SelfRegister: [
    { name: 'vault', type: 'address' },
    { name: 'name', type: 'string' },
    { name: 'metadataURI', type: 'string' },
    { name: 'signer', type: 'address' },
    { name: 'linkERC8004', type: 'bool' },
    { name: 'erc8004AgentId', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

export const SIGN_SELF_REGISTER_TOOL = {
  name: 'AlphagridActionProvider_sign_self_register',
  description:
    'Sign AlphaGrid AgentRegistry SelfRegister EIP-712 typed data for agent registration.',
  inputSchema: {
    type: 'object',
    properties: {
      vault: { type: 'string', description: 'Vault contract address' },
      name: { type: 'string', description: 'Agent display name' },
      metadataURI: { type: 'string', description: 'Agent metadata URI' },
      agentRegistry: {
        type: 'string',
        description: 'AgentRegistry verifying contract from registration quote',
      },
      chainId: {
        type: 'number',
        description: 'EIP-712 chain id from registration quote',
      },
      nonce: { type: 'string', description: 'Signer nonce (default 0)' },
      deadline: { type: 'string', description: 'Unix deadline timestamp' },
      linkERC8004: {
        type: 'boolean',
        description: 'Link ERC-8004 identity (default false)',
      },
      erc8004AgentId: {
        type: 'string',
        description: 'ERC-8004 token id when linking',
      },
    },
    required: [
      'vault',
      'name',
      'metadataURI',
      'agentRegistry',
      'chainId',
      'deadline',
    ],
  },
}

export async function handleSignSelfRegister(
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const account = getSigningAccount()
  const vault = args.vault as Address
  const name = args.name as string
  const metadataURI = args.metadataURI as string
  const agentRegistry = args.agentRegistry as Address
  const chainId = args.chainId as number
  const deadline = BigInt(args.deadline as string)
  const nonce = BigInt((args.nonce as string | undefined) ?? '0')
  const linkERC8004 = (args.linkERC8004 as boolean | undefined) ?? false
  const erc8004AgentId = BigInt(
    (args.erc8004AgentId as string | undefined) ?? '0'
  )

  const signature = await account.signTypedData({
    domain: {
      name: 'AlphaGrid AgentRegistry',
      version: '1',
      chainId,
      verifyingContract: agentRegistry,
    },
    types: SELF_REGISTER_TYPES,
    primaryType: 'SelfRegister',
    message: {
      vault,
      name,
      metadataURI,
      signer: account.address,
      linkERC8004,
      erc8004AgentId,
      nonce,
      deadline,
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
