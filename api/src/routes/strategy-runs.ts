import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import type { RouteHandler } from '@hono/zod-openapi'
import { ROUTE_PATHS } from '../constants/routes.js'
import type { StrategyRunListRow } from '../db/strategy-runs.repository.js'
import { StrategyRunsRepository } from '../db/strategy-runs.repository.js'
import { AppError } from '../errors.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import type { StrategyDecision } from '../lib/strategy/decision.js'
import type { ExecutionActionResult } from '../lib/strategy/executor.js'
import {
  getStrategyRunCooldown,
  loadStrategyRunManualCooldownMs,
} from '../lib/strategy/run-cooldown.js'
import { requirePrivyAuth } from '../middleware/privy-auth.js'
import { PrivyAuthHeadersSchema } from '../schemas/auth-headers.js'
import { agentIdParamSchema } from '../schemas/agent.js'
import {
  ListStrategyRunsQuerySchema,
  ListStrategyRunsResponseSchema,
  RunStrategyQuerySchema,
  RunStrategyResponseSchema,
  StrategyRunErrorSchema,
  StrategyRunItemSchema,
  StrategyRunStatusSchema,
} from '../schemas/strategy-run.js'
import { ManagedAgentService } from '../services/managed-agent.service.js'
import { StrategyRunnerService } from '../services/strategy-runner.service.js'

const strategyRunRoutes = new OpenAPIHono()

const privyProtectedPaths = [
  ROUTE_PATHS.agentStrategyRuns,
  ROUTE_PATHS.agentStrategyRunsRun,
] as const

for (const path of privyProtectedPaths) {
  strategyRunRoutes.use(path.replace(/\{(\w+)\}/g, ':$1'), requirePrivyAuth)
}

function toStrategyRunItem(row: StrategyRunListRow): z.infer<typeof StrategyRunItemSchema> {
  let summary: string | null = null
  let actions: StrategyDecision['actions'] = []
  let execution: ExecutionActionResult[] = []

  if (row.decision_json) {
    try {
      const decision = JSON.parse(row.decision_json) as StrategyDecision
      summary = decision.summary
      actions = decision.actions
    } catch {
      summary = null
      actions = []
    }
  }

  if (row.execution_json) {
    try {
      execution = JSON.parse(row.execution_json) as ExecutionActionResult[]
    } catch {
      execution = []
    }
  }

  return {
    runId: row.id,
    status: StrategyRunStatusSchema.parse(row.status),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    summary,
    actions,
    execution,
    error: row.error,
  }
}

const listStrategyRunsRoute = createRoute({
  method: 'get',
  path: ROUTE_PATHS.agentStrategyRuns,
  tags: ['Strategy'],
  summary: 'List strategy runs for an agent',
  description:
    'Returns recent strategy runner executions for a managed agent. Caller must be the on-chain owner (Privy wallet).',
  security: [{ bearerAuth: [] }],
  request: {
    headers: PrivyAuthHeadersSchema,
    params: z.object({
      agentId: agentIdParamSchema.openapi({
        param: { name: 'agentId', in: 'path' },
        example: '1',
      }),
    }),
    query: ListStrategyRunsQuerySchema,
  },
  responses: {
    200: {
      description: 'Strategy run history',
      content: {
        'application/json': { schema: ListStrategyRunsResponseSchema },
      },
    },
    401: {
      description: 'Missing or invalid Privy session',
      content: { 'application/json': { schema: StrategyRunErrorSchema } },
    },
    403: {
      description: 'Caller is not the on-chain agent owner',
      content: { 'application/json': { schema: StrategyRunErrorSchema } },
    },
    404: {
      description: 'Managed agent profile not found',
      content: { 'application/json': { schema: StrategyRunErrorSchema } },
    },
  },
})

const runStrategyRoute = createRoute({
  method: 'post',
  path: ROUTE_PATHS.agentStrategyRunsRun,
  tags: ['Strategy'],
  summary: 'Run strategy now for an agent',
  description:
    'Triggers an immediate strategy run for a managed agent. Caller must be the on-chain owner (Privy wallet). Respects STRATEGY_RUNNER_EXECUTE unless ?execute=false.',
  security: [{ bearerAuth: [] }],
  request: {
    headers: PrivyAuthHeadersSchema,
    params: z.object({
      agentId: agentIdParamSchema.openapi({
        param: { name: 'agentId', in: 'path' },
        example: '1',
      }),
    }),
    query: RunStrategyQuerySchema,
  },
  responses: {
    200: {
      description: 'Strategy run completed or failed with a persisted run record',
      content: {
        'application/json': { schema: RunStrategyResponseSchema },
      },
    },
    400: {
      description: 'Agent is archived',
      content: { 'application/json': { schema: StrategyRunErrorSchema } },
    },
    401: {
      description: 'Missing or invalid Privy session',
      content: { 'application/json': { schema: StrategyRunErrorSchema } },
    },
    403: {
      description: 'Caller is not the on-chain agent owner',
      content: { 'application/json': { schema: StrategyRunErrorSchema } },
    },
    404: {
      description: 'Managed agent profile not found',
      content: { 'application/json': { schema: StrategyRunErrorSchema } },
    },
    429: {
      description: 'Strategy was run within the cooldown window (default 5 minutes)',
      content: { 'application/json': { schema: StrategyRunErrorSchema } },
    },
    503: {
      description: 'Strategy run failed before a run record could be created',
      content: { 'application/json': { schema: StrategyRunErrorSchema } },
    }
  },
})

const listStrategyRunsHandler: RouteHandler<
  typeof listStrategyRunsRoute
> = async (c) => {
  const env = getWorkerEnv()
  const { agentId } = c.req.valid('param')
  const { limit } = c.req.valid('query')
  const ownerAddress = c.get('authAddress')

  const access = await ManagedAgentService.fromEnv(env).requireManagedOwner(
    agentId,
    ownerAddress
  )
  if ('error' in access) {
    const status = access.error.status === 403 ? 403 : 404
    return c.json({ error: access.error.message }, status)
  }

  const rows = await new StrategyRunsRepository(env).listByAgentId(
    agentId,
    limit
  )

  return c.json(
    {
      agentId,
      runs: rows.map(toStrategyRunItem),
    },
    200
  )
}

const runStrategyHandler: RouteHandler<typeof runStrategyRoute> = async (c) => {
  const env = getWorkerEnv()
  const { agentId } = c.req.valid('param')
  const { execute } = c.req.valid('query')
  const ownerAddress = c.get('authAddress')

  const access = await ManagedAgentService.fromEnv(env).requireManagedOwner(
    agentId,
    ownerAddress
  )
  if ('error' in access) {
    const status = access.error.status === 403 ? 403 : 404
    return c.json({ error: access.error.message }, status)
  }

  if (access.profile.archived_at !== null) {
    return c.json({ error: 'Archived agents cannot run strategy' }, 400)
  }

  const runsRepository = new StrategyRunsRepository(env)
  const lastStartedAt = await runsRepository.findLatestStartedAtByAgentId(agentId)
  const cooldown = getStrategyRunCooldown(
    lastStartedAt,
    loadStrategyRunManualCooldownMs(env)
  )
  if (!cooldown.allowed) {
    c.header('Retry-After', String(cooldown.retryAfterSeconds))
    return c.json(
      {
        error: `Strategy was run recently. Try again in ${cooldown.retryAfterSeconds} seconds.`,
      },
      429
    )
  }

  try {
    const result = await StrategyRunnerService.fromEnv(env).runAgentById(agentId, {
      executeOverride: execute === 'false' ? false : undefined,
    })

    if (!result.runId) {
      return c.json(
        { error: result.error ?? 'Strategy run failed before creating a run record' },
        503
      )
    }

    return c.json(
      {
        agentId,
        run: {
          runId: result.runId,
          status: result.status,
          startedAt: result.startedAt,
          completedAt: result.completedAt,
          summary: result.summary,
          actions: result.actions,
          execution: result.execution,
          error: result.error,
        },
      },
      200
    )
  } catch (error) {
    if (error instanceof AppError) {
      if (error.status === 400) {
        return c.json({ error: error.message }, 400)
      }
      if (error.status === 404) {
        return c.json({ error: error.message }, 404)
      }
    }
    throw error
  }
}

strategyRunRoutes.openapi(listStrategyRunsRoute, listStrategyRunsHandler)
strategyRunRoutes.openapi(runStrategyRoute, runStrategyHandler)

export { strategyRunRoutes }
