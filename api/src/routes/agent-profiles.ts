import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import type { RouteHandler } from '@hono/zod-openapi'
import { MAX_AGENTS_PER_USER } from '../constants/agent-limits.js'
import { ROUTE_PATHS } from '../constants/routes.js'
import { AgentProfilesRepository } from '../db/agent-profiles.repository.js'
import type { AgentProfileRow } from '../db/agent-profiles.repository.js'
import { AppError } from '../errors.js'
import { normalizeAddress } from '../lib/evm/utils.js'
import { computeNextRunAt } from '../lib/strategy/schedule.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import { requirePrivyAuth } from '../middleware/privy-auth.js'
import { agentIdParamSchema } from '../schemas/agent.js'
import {
  AgentProfileErrorSchema,
  AgentProfileListSchema,
  AgentProfileResponseSchema,
  ArchiveAgentResponseSchema,
  UpdateAgentProfileSchema,
} from '../schemas/agent-profile.js'
import { BotFrequencySchema } from '../schemas/agent-draft.js'
import { PrivyAuthHeadersSchema } from '../schemas/auth-headers.js'

const agentProfileRoutes = new OpenAPIHono()

const privyProtectedPaths = [
  ROUTE_PATHS.agentProfile,
  ROUTE_PATHS.agentArchive,
  ROUTE_PATHS.usersMeAgents,
] as const

for (const path of privyProtectedPaths) {
  agentProfileRoutes.use(path, requirePrivyAuth)
}

function toProfile(row: AgentProfileRow) {
  return {
    agentId: row.agent_id,
    handle: row.handle,
    strategy: row.strategy,
    botFrequency: BotFrequencySchema.parse(row.bot_frequency),
    pricingTier: row.pricing_tier,
    nextRunAt: row.next_run_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  }
}

async function requireOwnedProfile(
  agentId: string,
  ownerAddress: string
): Promise<
  | { profile: AgentProfileRow }
  | { error: 'not-found'; message: string }
  | { error: 'forbidden'; message: string }
> {
  const profile = await new AgentProfilesRepository(getWorkerEnv()).findByAgentId(
    agentId
  )
  if (!profile) {
    return { error: 'not-found', message: 'Agent profile not found' }
  }
  if (
    normalizeAddress(profile.owner_address) !== normalizeAddress(ownerAddress)
  ) {
    return { error: 'forbidden', message: 'Forbidden' }
  }
  return { profile }
}

const listMyAgentsRoute = createRoute({
  method: 'get',
  path: ROUTE_PATHS.usersMeAgents,
  tags: ['Agents'],
  summary: 'List off-chain agent profiles for authenticated user',
  description:
    'Returns all launched agent profiles owned by the authenticated wallet, including archived agents.',
  security: [{ bearerAuth: [] }],
  request: {
    headers: PrivyAuthHeadersSchema,
  },
  responses: {
    200: {
      description: 'Agent profile list',
      content: {
        'application/json': { schema: AgentProfileListSchema },
      },
    },
    401: {
      description: 'Missing or invalid Privy session',
      content: { 'application/json': { schema: AgentProfileErrorSchema } },
    },
  },
})

const getAgentProfileRoute = createRoute({
  method: 'get',
  path: ROUTE_PATHS.agentProfile,
  tags: ['Agents'],
  summary: 'Get off-chain agent profile',
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
      description: 'Off-chain agent profile',
      content: {
        'application/json': { schema: AgentProfileResponseSchema },
      },
    },
    401: {
      description: 'Missing or invalid Privy session',
      content: { 'application/json': { schema: AgentProfileErrorSchema } },
    },
    403: {
      description: 'Caller is not the agent owner',
      content: { 'application/json': { schema: AgentProfileErrorSchema } },
    },
    404: {
      description: 'Agent profile not found',
      content: { 'application/json': { schema: AgentProfileErrorSchema } },
    },
  },
})

const updateAgentProfileRoute = createRoute({
  method: 'patch',
  path: ROUTE_PATHS.agentProfile,
  tags: ['Agents'],
  summary: 'Update off-chain agent strategy profile',
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
        'application/json': { schema: UpdateAgentProfileSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated off-chain agent profile',
      content: {
        'application/json': { schema: AgentProfileResponseSchema },
      },
    },
    400: {
      description: 'Invalid update request or agent is archived',
      content: { 'application/json': { schema: AgentProfileErrorSchema } },
    },
    401: {
      description: 'Missing or invalid Privy session',
      content: { 'application/json': { schema: AgentProfileErrorSchema } },
    },
    403: {
      description: 'Caller is not the agent owner',
      content: { 'application/json': { schema: AgentProfileErrorSchema } },
    },
    404: {
      description: 'Agent profile not found',
      content: { 'application/json': { schema: AgentProfileErrorSchema } },
    },
  },
})

const archiveAgentRoute = createRoute({
  method: 'post',
  path: ROUTE_PATHS.agentArchive,
  tags: ['Agents'],
  summary: 'Archive agent',
  description:
    'Marks an agent profile as archived. Archived agents stop strategy runner executions and no longer count toward the per-user agent limit.',
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
      description: 'Archived agent profile',
      content: {
        'application/json': { schema: ArchiveAgentResponseSchema },
      },
    },
    400: {
      description: 'Agent is already archived',
      content: { 'application/json': { schema: AgentProfileErrorSchema } },
    },
    401: {
      description: 'Missing or invalid Privy session',
      content: { 'application/json': { schema: AgentProfileErrorSchema } },
    },
    403: {
      description: 'Caller is not the agent owner',
      content: { 'application/json': { schema: AgentProfileErrorSchema } },
    },
    404: {
      description: 'Agent profile not found',
      content: { 'application/json': { schema: AgentProfileErrorSchema } },
    },
  },
})

const listMyAgentsHandler: RouteHandler<typeof listMyAgentsRoute> = async (
  c
) => {
  const rows = await new AgentProfilesRepository(getWorkerEnv()).findByOwner(
    c.get('authAddress')
  )
  const agents = rows.map(toProfile)
  const activeCount = agents.filter((agent) => agent.archivedAt === null).length

  return c.json(
    {
      agents,
      total: agents.length,
      activeCount,
      maxAgents: MAX_AGENTS_PER_USER,
    },
    200
  )
}

const getAgentProfileHandler: RouteHandler<typeof getAgentProfileRoute> = async (
  c
) => {
  const profile = await requireOwnedProfile(
    c.req.valid('param').agentId,
    c.get('authAddress')
  )
  if ('error' in profile) {
    return c.json(
      { error: profile.message },
      profile.error === 'not-found' ? 404 : 403
    )
  }

  return c.json({ profile: toProfile(profile.profile) }, 200)
}

const updateAgentProfileHandler: RouteHandler<
  typeof updateAgentProfileRoute
> = async (c) => {
  const { agentId } = c.req.valid('param')
  const body = c.req.valid('json')
  const existing = await requireOwnedProfile(agentId, c.get('authAddress'))
  if ('error' in existing) {
    return c.json(
      { error: existing.message },
      existing.error === 'not-found' ? 404 : 403
    )
  }

  if (existing.profile.archived_at !== null) {
    return c.json({ error: 'Archived agents cannot be updated' }, 400)
  }

  const updated = await new AgentProfilesRepository(getWorkerEnv()).update(
    agentId,
    {
      strategy: body.strategy,
      botFrequency: body.botFrequency,
      nextRunAt:
        body.botFrequency !== undefined
          ? computeNextRunAt(body.botFrequency)
          : undefined,
    }
  )

  if (!updated) {
    return c.json({ error: 'Agent profile not found' }, 404)
  }

  return c.json({ profile: toProfile(updated) }, 200)
}

const archiveAgentHandler: RouteHandler<typeof archiveAgentRoute> = async (
  c
) => {
  const { agentId } = c.req.valid('param')
  const existing = await requireOwnedProfile(agentId, c.get('authAddress'))
  if ('error' in existing) {
    return c.json(
      { error: existing.message },
      existing.error === 'not-found' ? 404 : 403
    )
  }

  if (existing.profile.archived_at !== null) {
    return c.json({ error: 'Agent is already archived' }, 400)
  }

  const archived = await new AgentProfilesRepository(getWorkerEnv()).archive(
    agentId,
    new Date().toISOString()
  )

  if (!archived) {
    throw new AppError('Failed to archive agent', 503, 'SERVICE_UNAVAILABLE')
  }

  return c.json({ profile: toProfile(archived) }, 200)
}

agentProfileRoutes.openapi(listMyAgentsRoute, listMyAgentsHandler)
agentProfileRoutes.openapi(getAgentProfileRoute, getAgentProfileHandler)
agentProfileRoutes.openapi(updateAgentProfileRoute, updateAgentProfileHandler)
agentProfileRoutes.openapi(archiveAgentRoute, archiveAgentHandler)

export { agentProfileRoutes }
