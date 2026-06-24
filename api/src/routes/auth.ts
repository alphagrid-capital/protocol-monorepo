import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { ROUTE_PATHS } from '../constants/routes.js'
import { AppError } from '../errors.js'
import { getClientIp } from '../lib/auth/client-ip.js'
import { requirePrivyAuth } from '../middleware/privy-auth.js'
import { PrivyAuthHeadersSchema } from '../schemas/auth-headers.js'
import {
  AuthErrorSchema,
  LogoutResponseSchema,
  SessionResponseSchema,
} from '../schemas/auth.js'
import {
  toUserProfileSummary,
  UsersService,
} from '../services/users.service.js'
import { getWorkerEnv } from '../lib/worker-env.js'

const getSessionRoute = createRoute({
  method: 'get',
  path: ROUTE_PATHS.authMe,
  tags: ['Auth'],
  summary: 'Get authenticated session',
  description:
    'Verifies Privy access and identity tokens, upserts the user profile in D1, and returns the wallet address with profile summary. Send `Authorization: Bearer <access_token>` and `privy-id-token: <identity_token>` from the Privy client SDK.',
  request: {
    headers: PrivyAuthHeadersSchema,
  },
  responses: {
    200: {
      description: 'Authenticated session',
      content: {
        'application/json': { schema: SessionResponseSchema },
      },
    },
    401: {
      description: 'Missing or invalid Privy session',
      content: { 'application/json': { schema: AuthErrorSchema } },
    },
    503: {
      description: 'Auth or database not configured',
      content: { 'application/json': { schema: AuthErrorSchema } },
    },
  },
})

const postLogoutRoute = createRoute({
  method: 'post',
  path: ROUTE_PATHS.authLogout,
  tags: ['Auth'],
  summary: 'Logout',
  description:
    'Acknowledges logout. Clients should discard Privy tokens locally; the server does not maintain a session store.',
  responses: {
    200: {
      description: 'Logged out',
      content: {
        'application/json': { schema: LogoutResponseSchema },
      },
    },
  },
})

export const authRoutes = new OpenAPIHono()

authRoutes.use(ROUTE_PATHS.authMe, requirePrivyAuth)
authRoutes.openapi(getSessionRoute, async (c) => {
  try {
    const profile = await UsersService.fromEnv(getWorkerEnv()).upsertOnLogin(
      c.get('authAddress'),
      getClientIp(c.req.raw)
    )
    return c.json(
      {
        address: profile.address,
        valid: true as const,
        profile: toUserProfileSummary(profile),
      },
      200
    )
  } catch (error) {
    if (error instanceof AppError && error.status === 503) {
      return c.json({ error: error.message }, 503)
    }
    throw error
  }
})

authRoutes.openapi(postLogoutRoute, (c) => c.json({ ok: true as const }, 200))
