import type { WorkerEnv } from '../types/worker-env.js'

export function isOracleRefreshAuthorized(
  env: WorkerEnv,
  authorizationHeader: string | undefined
): boolean {
  const secret = env.ORACLE_REFRESH_SECRET
  if (!secret) {
    return true
  }
  if (!authorizationHeader?.startsWith('Bearer ')) {
    return false
  }
  return authorizationHeader.slice('Bearer '.length) === secret
}
