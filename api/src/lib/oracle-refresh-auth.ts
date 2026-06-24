import type { WorkerEnv } from '../types/worker-env.js'
import { extractBearerToken } from './bearer-auth.js'

export function isOracleRefreshAuthorized(
  env: WorkerEnv,
  authorizationHeader: string | undefined
): boolean {
  const secret = env.ORACLE_REFRESH_SECRET
  if (!secret) {
    return true
  }
  const token = extractBearerToken(authorizationHeader)
  if (!token) {
    return false
  }
  return token === secret
}
