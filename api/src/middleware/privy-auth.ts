import type { MiddlewareHandler } from 'hono'
import { AppError } from '../errors.js'
import { extractBearerToken } from '../lib/auth/bearer-auth.js'
import { verifyPrivySession } from '../lib/auth/privy-auth.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import { PRIVY_ID_TOKEN_HEADER } from '../schemas/auth-headers.js'

function readPrivyTokens(
  authorizationHeader: string | undefined,
  identityTokenHeader: string | undefined
): { accessToken: string; identityToken: string } | null {
  const accessToken = extractBearerToken(authorizationHeader)
  if (!accessToken || !identityTokenHeader) {
    return null
  }
  return { accessToken, identityToken: identityTokenHeader }
}

export const requirePrivyAuth: MiddlewareHandler = async (c, next) => {
  const tokens = readPrivyTokens(
    c.req.header('Authorization'),
    c.req.header(PRIVY_ID_TOKEN_HEADER)
  )
  if (!tokens) {
    const message = extractBearerToken(c.req.header('Authorization'))
      ? `Missing ${PRIVY_ID_TOKEN_HEADER} header`
      : 'Unauthorized'
    return c.json({ error: message }, 401)
  }

  try {
    c.set(
      'authAddress',
      await verifyPrivySession(
        getWorkerEnv(),
        tokens.accessToken,
        tokens.identityToken
      )
    )
    await next()
  } catch (error) {
    if (error instanceof AppError) {
      return c.json(
        { error: error.message },
        error.status === 503 ? 503 : 401
      )
    }
    throw error
  }
}
