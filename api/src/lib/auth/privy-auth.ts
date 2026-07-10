import {
  InvalidAuthTokenError,
  isEmbeddedWalletLinkedAccount,
  verifyAccessToken,
  verifyIdentityToken,
} from '@privy-io/node'
import type { LinkedAccount } from '@privy-io/node'
import { AppError } from '../../errors.js'
import { loadAuthConfig } from './auth-config.js'
import { normalizeAddress } from '../evm/utils.js'
import type { WorkerEnv } from '../../types/worker-env.js'

function isEthereumLinkedAccount(
  account: LinkedAccount
): account is LinkedAccount & { address: string } {
  return (
    account.type === 'smart_wallet' ||
    (account.type === 'wallet' && account.chain_type === 'ethereum')
  )
}

function pickEthereumWalletAddress(accounts: LinkedAccount[]): string {
  const ethereumAccounts = accounts.filter(isEthereumLinkedAccount)
  if (ethereumAccounts.length === 0) {
    throw new AppError('No linked Ethereum wallet', 401, 'INVALID_REQUEST')
  }

  const embedded = ethereumAccounts.find(isEmbeddedWalletLinkedAccount)
  return normalizeAddress((embedded ?? ethereumAccounts[0]).address)
}

function pickEmail(accounts: LinkedAccount[]): string | null {
  const emailAccount = accounts.find(
    (account): account is LinkedAccount & { type: 'email'; address: string } =>
      account.type === 'email'
  )
  if (emailAccount) {
    return emailAccount.address.toLowerCase()
  }

  for (const account of accounts) {
    if (
      'email' in account &&
      typeof account.email === 'string' &&
      account.email.length > 0
    ) {
      return account.email.toLowerCase()
    }
  }

  return null
}

export interface PrivySession {
  address: string
  email: string | null
}

export async function verifyPrivySession(
  env: WorkerEnv,
  accessToken: string,
  identityToken: string
): Promise<PrivySession> {
  const config = loadAuthConfig(env)

  try {
    const [access, user] = await Promise.all([
      verifyAccessToken({
        access_token: accessToken,
        app_id: config.appId,
        verification_key: config.jwtVerificationKey,
      }),
      verifyIdentityToken({
        identity_token: identityToken,
        app_id: config.appId,
        verification_key: config.jwtVerificationKey,
      }),
    ])

    if (user.id !== access.user_id) {
      throw new AppError('Unauthorized', 401, 'INVALID_REQUEST')
    }

    return {
      address: pickEthereumWalletAddress(user.linked_accounts),
      email: pickEmail(user.linked_accounts),
    }
  } catch (error) {
    if (error instanceof InvalidAuthTokenError) {
      throw new AppError('Unauthorized', 401, 'INVALID_REQUEST')
    }
    throw error
  }
}
