import { z } from '@hono/zod-openapi'
import type { StrategyRunStatus } from '../db/strategy-runs.repository.js'
import { agentIdParamSchema } from './agent.js'
import { StrategyActionSchema } from './strategy.js'

export const StrategyRunStatusSchema = z.enum([
  'running',
  'completed',
  'failed',
]) satisfies z.ZodType<StrategyRunStatus>

export const ExecutionActionResultSchema = z
  .object({
    action: StrategyActionSchema,
    status: z.enum(['ok', 'failed']),
    txHash: z.string().optional(),
    positionId: z.string().optional(),
    error: z.string().optional(),
  })
  .openapi('ExecutionActionResult')

export const StrategyRunItemSchema = z
  .object({
    runId: z.string(),
    status: StrategyRunStatusSchema,
    startedAt: z.string(),
    completedAt: z.string().nullable(),
    summary: z.string().nullable(),
    actions: z.array(StrategyActionSchema),
    execution: z.array(ExecutionActionResultSchema),
    error: z.string().nullable(),
  })
  .openapi('StrategyRunItem')

export const ListStrategyRunsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const ListStrategyRunsResponseSchema = z
  .object({
    agentId: agentIdParamSchema,
    runs: z.array(StrategyRunItemSchema),
  })
  .openapi('ListStrategyRunsResponse')

export const StrategyRunErrorSchema = z
  .object({
    error: z.string(),
  })
  .openapi('StrategyRunError')

export const RunStrategyQuerySchema = z.object({
  execute: z
    .enum(['true', 'false'])
    .optional()
    .openapi({
      param: { name: 'execute', in: 'query' },
      description:
        'When false, compute the strategy decision but skip trade execution even if STRATEGY_RUNNER_EXECUTE is enabled.',
      example: 'false',
    }),
})

export const RunStrategyResponseSchema = z
  .object({
    agentId: agentIdParamSchema,
    run: StrategyRunItemSchema,
  })
  .openapi('RunStrategyResponse')
