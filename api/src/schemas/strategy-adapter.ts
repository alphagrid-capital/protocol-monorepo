import { z } from 'zod'
import { StrategyActionSchema, StrategyDecisionSchema } from './strategy.js'

export const StrategyAdapterErrorCodeSchema = z.enum([
  'PROMPT_INJECTION',
  'STRATEGY_TOO_LONG',
  'INVALID_MODEL_OUTPUT',
  'AI_UNAVAILABLE',
])

export type StrategyAdapterErrorCode = z.infer<
  typeof StrategyAdapterErrorCodeSchema
>

export const StrategyAdapterOkOutcomeSchema = z
  .object({
    status: z.literal('ok'),
    summary: z.string(),
    actions: z.array(StrategyActionSchema),
  })
  .strict()

export const StrategyAdapterErrorOutcomeSchema = z
  .object({
    status: z.literal('error'),
    code: StrategyAdapterErrorCodeSchema,
    summary: z.string(),
    message: z.string(),
    actions: z.tuple([]).default([]),
  })
  .strict()

export const StrategyAdapterOutcomeSchema = z.discriminatedUnion('status', [
  StrategyAdapterOkOutcomeSchema,
  StrategyAdapterErrorOutcomeSchema,
])

export type StrategyAdapterOutcome = z.infer<
  typeof StrategyAdapterOutcomeSchema
>

export const StrategyAiSafetySchema = z
  .object({
    passed: z.boolean(),
    reason: z.string(),
  })
  .strict()

export const StrategyAiEnvelopeSchema = z
  .object({
    safety: StrategyAiSafetySchema,
    decision: StrategyDecisionSchema.nullable(),
  })
  .strict()

export type StrategyAiEnvelope = z.infer<typeof StrategyAiEnvelopeSchema>
