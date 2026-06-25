import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import type { RouteHandler } from '@hono/zod-openapi'
import { ROUTE_PATHS } from '../constants/routes.js'
import { StrategyRunsRepository } from '../db/strategy-runs.repository.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import { requirePrivyAuth } from '../middleware/privy-auth.js'
import { PrivyAuthHeadersSchema } from '../schemas/auth-headers.js'
import { agentIdParamSchema } from '../schemas/agent.js'
import {
  ListStrategyRunsQuerySchema,
  ListStrategyRunsResponseSchema,
  StrategyRunErrorSchema,
  StrategyRunStatusSchema,
} from '../schemas/strategy-run.js'
import type { StrategyDecision } from '../lib/strategy/decision.js'
import type { ExecutionActionResult } from '../lib/strategy/executor.js'
import { ManagedAgentService } from '../services/managed-agent.service.js'

const strategyRunRoutes = new OpenAPIHono()

strategyRunRoutes.use(
  ROUTE_PATHS.agentStrategyRuns.replace(/\{(\w+)\}/g, ':$1'),
  requirePrivyAuth
)

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

  const runs = rows.map((row) => {
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
  })

  return c.json({ agentId, runs }, 200)
}

strategyRunRoutes.openapi(listStrategyRunsRoute, listStrategyRunsHandler)

export { strategyRunRoutes }
