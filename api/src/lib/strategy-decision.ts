import { z } from 'zod'
import { ExitRuleInputSchema } from '../schemas/trading.js'
import type { BotFrequency } from '../schemas/agent-draft.js'
import type { ListAgentPositionsResponse } from '../schemas/trading.js'
import type { OraclePriceEntry } from '../services/tokens.service.js'

const OpenActionSchema = z
  .object({
    type: z.literal('open'),
    symbol: z.string().min(1),
    usdcAmount: z.string().regex(/^\d+(\.\d+)?$/),
    minTokenOut: z.string().regex(/^\d+$/).optional(),
    maxSlippageBps: z.number().int().min(0).max(10000).optional(),
    exits: z.array(ExitRuleInputSchema).min(1).max(5).optional(),
  })
  .strict()

const CloseActionSchema = z
  .object({
    type: z.literal('close'),
    positionId: z.string().regex(/^\d+$/),
    exitBps: z.number().int().min(1).max(10000).optional(),
  })
  .strict()

const AddActionSchema = z
  .object({
    type: z.literal('add'),
    positionId: z.string().regex(/^\d+$/),
    usdcAmount: z.string().regex(/^\d+(\.\d+)?$/),
    minTokenOut: z.string().regex(/^\d+$/).optional(),
    maxSlippageBps: z.number().int().min(0).max(10000).optional(),
  })
  .strict()

const ReduceActionSchema = z
  .object({
    type: z.literal('reduce'),
    positionId: z.string().regex(/^\d+$/),
    exitBps: z.number().int().min(1).max(10000),
  })
  .strict()

export const StrategyActionSchema = z.discriminatedUnion('type', [
  OpenActionSchema,
  CloseActionSchema,
  AddActionSchema,
  ReduceActionSchema,
])

export const StrategyDecisionSchema = z
  .object({
    summary: z.string(),
    actions: z.array(StrategyActionSchema),
  })
  .strict()

export type StrategyAction = z.infer<typeof StrategyActionSchema>
export type StrategyDecision = z.infer<typeof StrategyDecisionSchema>

export interface StrategyContext {
  agentId: string
  strategy: string
  botFrequency: BotFrequency
  prices: Record<string, OraclePriceEntry>
  positions: ListAgentPositionsResponse['positions']
}

export async function decideStrategy(
  _context: StrategyContext
): Promise<StrategyDecision> {
  return {
    summary: 'Hold — no trades recommended.',
    actions: [],
  }
}
