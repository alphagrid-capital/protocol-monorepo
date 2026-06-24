import {
  InvalidAuthTokenError,
  isEmbeddedWalletLinkedAccount,
  verifyAccessToken,
  verifyIdentityToken
  
} from '@privy-io/node'
import type {LinkedAccount} from '@privy-io/node';
import { AppError } from '../errors.js'
import { loadAuthConfig } from './auth-config.js'
import { normalizeAddress } from './evm-uilts.js'
import type { WorkerEnv } from '../types/worker-env.js'

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

export async function verifyPrivySession(
  env: WorkerEnv,
  accessToken: string,
  identityToken: string
): Promise<string> {
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

    return pickEthereumWalletAddress(user.linked_accounts)
  } catch (error) {
    if (error instanceof InvalidAuthTokenError) {
      throw new AppError('Unauthorized', 401, 'INVALID_REQUEST')
    }
    throw error
  }
}
