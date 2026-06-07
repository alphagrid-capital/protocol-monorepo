import { z } from '@hono/zod-openapi'
import { agentIdParamSchema } from './agent.js'

export const TradingNotImplementedSchema = z
  .object({
    error: z.literal('Not implemented'),
    code: z.literal('NOT_IMPLEMENTED'),
    message: z.string(),
  })
  .openapi('TradingNotImplemented')

export const TradeIntentRequestSchema = z
  .object({
    agentId: agentIdParamSchema.optional().openapi({
      description: 'Required for POST /intents/trade; omitted when agentId is in the path',
    }),
    trackId: z.string().regex(/^\d+$/).openapi({ example: '0' }),
    action: z.enum(['swap', 'open', 'close']).openapi({ example: 'swap' }),
    inputAsset: z.string().min(1).openapi({ example: 'USDC' }),
    outputAsset: z.string().min(1).openapi({ example: 'NVDA' }),
    amount: z.string().min(1).openapi({ example: '1000' }),
    minOutputAmount: z.string().optional().openapi({ example: '5.32' }),
    maxSlippageBps: z.number().int().optional().openapi({ example: 50 }),
    venue: z.string().optional(),
    deadline: z.number().int().openapi({ example: 1_710_000_000 }),
    nonce: z.number().int().openapi({ example: 42 }),
    signature: z
      .string()
      .regex(/^0x[a-fA-F0-9]+$/)
      .openapi({ example: '0x' }),
  })
  .strict()
  .openapi('TradeIntentRequest')

export const intentIdParamSchema = z
  .string()
  .uuid()
  .openapi({ example: '00000000-0000-4000-8000-000000000001' })

export const SubmitTradeIntentInputSchema = TradeIntentRequestSchema.extend({
  agentId: agentIdParamSchema,
}).strict()

export const GetAgentTradingInputSchema = z
  .object({
    agentId: agentIdParamSchema,
  })
  .strict()

export const GetIntentStatusInputSchema = z
  .object({
    intentId: intentIdParamSchema,
  })
  .strict()
