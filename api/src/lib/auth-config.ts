import { AppError } from '../errors.js'
import type { WorkerEnv } from '../types/worker-env.js'

export interface AuthConfig {
  appId: string
  jwtVerificationKey: string
}

let cachedConfig: AuthConfig | null = null
let cachedConfigKey = ''

function configCacheKey(env: WorkerEnv): string {
  return `${env.PRIVY_APP_ID ?? ''}:${env.PRIVY_JWT_VERIFICATION_KEY ?? ''}`
}

export function loadAuthConfig(env: WorkerEnv): AuthConfig {
  const key = configCacheKey(env)
  if (cachedConfig && cachedConfigKey === key) {
    return cachedConfig
  }

  const appId = env.PRIVY_APP_ID
  const jwtVerificationKey = env.PRIVY_JWT_VERIFICATION_KEY

  if (!appId || !jwtVerificationKey) {
    throw new AppError('Auth not configured', 503, 'SERVICE_UNAVAILABLE')
  }

  cachedConfigKey = key
  cachedConfig = {
    appId,
    jwtVerificationKey: jwtVerificationKey.replace(/\\n/g, '\n'),
  }
  return cachedConfig
}
