import type { Address } from 'viem'
import type { Context } from 'hono'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import type { RouteHandler } from '@hono/zod-openapi'
import { ROUTE_PATHS } from '../constants/routes.js'
import { AppError } from '../errors.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import { requirePrivyAuth } from '../middleware/privy-auth.js'
import { agentIdParamSchema } from '../schemas/agent.js'
import {
  ArchiveManagedAgentResponseSchema,
  ManagedAgentErrorSchema,
  ManagedAgentListSchema,
  ManagedAgentResponseSchema,
  UpdateManagedAgentSchema,
} from '../schemas/managed-agent.js'
import { PrivyAuthHeadersSchema } from '../schemas/auth-headers.js'
import { ManagedAgentService } from '../services/managed-agent.service.js'

const managedAgentRoutes = new OpenAPIHono()

const privyProtectedPaths = [
  ROUTE_PATHS.managedAgentsMe,
  ROUTE_PATHS.managedAgentById,
  ROUTE_PATHS.managedAgentArchive,
] as const

for (const path of privyProtectedPaths) {
  managedAgentRoutes.use(path.replace(/\{(\w+)\}/g, ':$1'), requirePrivyAuth)
}

function handleManagedRouteError(c: Context, error: unknown): never {
  if (error instanceof AppError) {
    if (error.status === 400) {
      return c.json({ error: error.message }, 400) as never
    }
    if (error.status === 403) {
      return c.json({ error: error.message }, 403) as never
    }
    if (error.status === 404) {
      return c.json({ error: error.message }, 404) as never
    }
    if (error.status === 503) {
      return c.json({ error: error.message }, 503) as never
    }
  }
  throw error
}

const listManagedAgentsRoute = createRoute({
  method: 'get',
  path: ROUTE_PATHS.managedAgentsMe,
  tags: ['Managed agents'],
  summary: 'List managed agents for authenticated user',
  description:
    'Returns managed agent profiles for agents currently owned on-chain by the authenticated wallet.',
  security: [{ bearerAuth: [] }],
  request: {
    headers: PrivyAuthHeadersSchema,
  },
  responses: {
    200: {
      description: 'Managed agent list',
      content: {
        'application/json': { schema: ManagedAgentListSchema },
      },
    },
    401: {
      description: 'Missing or invalid Privy session',
      content: { 'application/json': { schema: ManagedAgentErrorSchema } },
    },
  },
})

const getManagedAgentRoute = createRoute({
  method: 'get',
  path: ROUTE_PATHS.managedAgentById,
  tags: ['Managed agents'],
  summary: 'Get managed agent profile',
  description:
    'Returns the owner-only off-chain profile used by the strategy runner, including strategy text and run frequency.',
  security: [{ bearerAuth: [] }],
  request: {
    headers: PrivyAuthHeadersSchema,
    params: z.object({
      agentId: agentIdParamSchema.openapi({
        param: { name: 'agentId', in: 'path' },
        example: '1',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Managed agent profile',
      content: {
        'application/json': { schema: ManagedAgentResponseSchema },
      },
    },
    401: {
      description: 'Missing or invalid Privy session',
      content: { 'application/json': { schema: ManagedAgentErrorSchema } },
    },
    403: {
      description: 'Caller is not the on-chain agent owner',
      content: { 'application/json': { schema: ManagedAgentErrorSchema } },
    },
    404: {
      description: 'Managed agent profile not found',
      content: { 'application/json': { schema: ManagedAgentErrorSchema } },
    },
  },
})

const updateManagedAgentRoute = createRoute({
  method: 'patch',
  path: ROUTE_PATHS.managedAgentById,
  tags: ['Managed agents'],
  summary: 'Update managed agent strategy profile',
  description:
    'Updates strategy text and/or bot frequency for future strategy runner executions. No on-chain metadata is changed.',
  security: [{ bearerAuth: [] }],
  request: {
    headers: PrivyAuthHeadersSchema,
    params: z.object({
      agentId: agentIdParamSchema.openapi({
        param: { name: 'agentId', in: 'path' },
        example: '1',
      }),
    }),
    body: {
      content: {
        'application/json': { schema: UpdateManagedAgentSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated managed agent profile',
      content: {
        'application/json': { schema: ManagedAgentResponseSchema },
      },
    },
    400: {
      description: 'Invalid update request or agent is archived',
      content: { 'application/json': { schema: ManagedAgentErrorSchema } },
    },
    401: {
      description: 'Missing or invalid Privy session',
      content: { 'application/json': { schema: ManagedAgentErrorSchema } },
    },
    403: {
      description: 'Caller is not the on-chain agent owner',
      content: { 'application/json': { schema: ManagedAgentErrorSchema } },
    },
    404: {
      description: 'Managed agent profile not found',
      content: { 'application/json': { schema: ManagedAgentErrorSchema } },
    },
  },
})

const archiveManagedAgentRoute = createRoute({
  method: 'post',
  path: ROUTE_PATHS.managedAgentArchive,
  tags: ['Managed agents'],
  summary: 'Archive managed agent',
  description:
    'Marks a managed agent profile as archived. Archived agents stop strategy runner executions, wipe the custodial signer key, and no longer count toward the per-user agent limit.',
  security: [{ bearerAuth: [] }],
  request: {
    headers: PrivyAuthHeadersSchema,
    params: z.object({
      agentId: agentIdParamSchema.openapi({
        param: { name: 'agentId', in: 'path' },
        example: '1',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Archived managed agent profile',
      content: {
        'application/json': { schema: ArchiveManagedAgentResponseSchema },
      },
    },
    400: {
      description: 'Agent is already archived',
      content: { 'application/json': { schema: ManagedAgentErrorSchema } },
    },
    401: {
      description: 'Missing or invalid Privy session',
      content: { 'application/json': { schema: ManagedAgentErrorSchema } },
    },
    403: {
      description: 'Caller is not the on-chain agent owner',
      content: { 'application/json': { schema: ManagedAgentErrorSchema } },
    },
    404: {
      description: 'Managed agent profile not found',
      content: { 'application/json': { schema: ManagedAgentErrorSchema } },
    },
  },
})

const listManagedAgentsHandler: RouteHandler<
  typeof listManagedAgentsRoute
> = async (c) => {
  const result = await ManagedAgentService.fromEnv(
    getWorkerEnv()
  ).listManagedForOwner(c.get('authAddress') as Address)
  return c.json(result, 200)
}

const getManagedAgentHandler: RouteHandler<
  typeof getManagedAgentRoute
> = async (c) => {
  try {
    const profile = await ManagedAgentService.fromEnv(
      getWorkerEnv()
    ).getManagedProfile(c.req.valid('param').agentId, c.get('authAddress'))
    return c.json({ profile }, 200)
  } catch (error) {
    return handleManagedRouteError(c, error)
  }
}

const updateManagedAgentHandler: RouteHandler<
  typeof updateManagedAgentRoute
> = async (c) => {
  const { agentId } = c.req.valid('param')
  const body = c.req.valid('json')
  try {
    const profile = await ManagedAgentService.fromEnv(
      getWorkerEnv()
    ).updateManagedProfile(agentId, c.get('authAddress'), body)
    return c.json({ profile }, 200)
  } catch (error) {
    return handleManagedRouteError(c, error)
  }
}

const archiveManagedAgentHandler: RouteHandler<
  typeof archiveManagedAgentRoute
> = async (c) => {
  const { agentId } = c.req.valid('param')
  try {
    const profile = await ManagedAgentService.fromEnv(
      getWorkerEnv()
    ).archiveManagedAgent(agentId, c.get('authAddress'))
    return c.json({ profile }, 200)
  } catch (error) {
    return handleManagedRouteError(c, error)
  }
}

managedAgentRoutes.openapi(listManagedAgentsRoute, listManagedAgentsHandler)
managedAgentRoutes.openapi(getManagedAgentRoute, getManagedAgentHandler)
managedAgentRoutes.openapi(updateManagedAgentRoute, updateManagedAgentHandler)
managedAgentRoutes.openapi(archiveManagedAgentRoute, archiveManagedAgentHandler)

export { managedAgentRoutes }
