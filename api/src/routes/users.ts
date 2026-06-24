import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { ROUTE_PATHS } from '../constants/routes.js'
import { AppError } from '../errors.js'
import { requirePrivyAuth } from '../middleware/privy-auth.js'
import { PrivyAuthHeadersSchema } from '../schemas/auth-headers.js'
import {
  UpdateUserProfileSchema,
  UserErrorSchema,
  UserProfileSchema,
} from '../schemas/user.js'
import { UsersService } from '../services/users.service.js'
import { getWorkerEnv } from '../lib/worker-env.js'

function getUserErrorResponse(error: unknown): {
  status: 404 | 503
  body: { error: string }
} {
  if (
    error instanceof AppError &&
    (error.status === 404 || error.status === 503)
  ) {
    return { status: error.status, body: { error: error.message } }
  }
  throw error
}

function patchUserErrorResponse(error: unknown): {
  status: 400 | 404 | 503
  body: { error: string }
} {
  if (
    error instanceof AppError &&
    (error.status === 400 || error.status === 404 || error.status === 503)
  ) {
    return { status: error.status, body: { error: error.message } }
  }
  throw error
}

const getUserProfileRoute = createRoute({
  method: 'get',
  path: ROUTE_PATHS.usersMe,
  tags: ['Users'],
  summary: 'Get authenticated user profile',
  description:
    'Returns the wallet profile for the authenticated Privy session, including display name and preferred currency.',
  request: {
    headers: PrivyAuthHeadersSchema,
  },
  responses: {
    200: {
      description: 'User profile',
      content: {
        'application/json': { schema: UserProfileSchema },
      },
    },
    401: {
      description: 'Missing or invalid Privy session',
      content: { 'application/json': { schema: UserErrorSchema } },
    },
    404: {
      description: 'User not found',
      content: { 'application/json': { schema: UserErrorSchema } },
    },
    503: {
      description: 'Database not configured',
      content: { 'application/json': { schema: UserErrorSchema } },
    },
  },
})

const patchUserProfileRoute = createRoute({
  method: 'patch',
  path: ROUTE_PATHS.usersMe,
  tags: ['Users'],
  summary: 'Update authenticated user profile',
  description:
    'Updates display name and/or preferred currency for the authenticated wallet.',
  request: {
    headers: PrivyAuthHeadersSchema,
    body: {
      content: {
        'application/json': { schema: UpdateUserProfileSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated user profile',
      content: {
        'application/json': { schema: UserProfileSchema },
      },
    },
    400: {
      description: 'Invalid profile update',
      content: { 'application/json': { schema: UserErrorSchema } },
    },
    401: {
      description: 'Missing or invalid Privy session',
      content: { 'application/json': { schema: UserErrorSchema } },
    },
    404: {
      description: 'User not found',
      content: { 'application/json': { schema: UserErrorSchema } },
    },
    503: {
      description: 'Database not configured',
      content: { 'application/json': { schema: UserErrorSchema } },
    },
  },
})

export const userRoutes = new OpenAPIHono()

userRoutes.use(ROUTE_PATHS.usersMe, requirePrivyAuth)

userRoutes.openapi(getUserProfileRoute, async (c) => {
  try {
    const profile = await UsersService.fromEnv(getWorkerEnv()).getProfile(
      c.get('authAddress')
    )
    return c.json(profile, 200)
  } catch (error) {
    const { status, body } = getUserErrorResponse(error)
    return c.json(body, status)
  }
})

userRoutes.openapi(patchUserProfileRoute, async (c) => {
  const body = c.req.valid('json')
  try {
    const profile = await UsersService.fromEnv(getWorkerEnv()).updateProfile(
      c.get('authAddress'),
      body
    )
    return c.json(profile, 200)
  } catch (error) {
    const { status, body: errorBody } = patchUserErrorResponse(error)
    return c.json(errorBody, status)
  }
})
