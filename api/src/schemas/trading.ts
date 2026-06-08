import { z } from '@hono/zod-openapi'
import { agentIdParamSchema } from './agent.js'

export const TradingNotImplementedSchema = z
  .object({
    error: z.literal('Not implemented'),
    code: z.literal('NOT_IMPLEMENTED'),
    message: z.string(),
  })
  .openapi('TradingNotImplemented')

export const TradingErrorSchema = z
  .object({
    error: z.string(),
  })
  .openapi('TradingError')

export const ExitRuleInputSchema = z
  .object({
    triggerType: z.enum(['StopLoss', 'TakeProfit']),
    triggerBps: z.number().int(),
    exitBps: z.number().int().min(1).max(10000),
  })
  .strict()

export type ExitRuleInput = z.infer<typeof ExitRuleInputSchema>

export const OpenPositionRequestSchema = z
  .object({
    symbol: z.string().min(1).openapi({ example: 'NVDA' }),
    usdcAmount: z
      .string()
      .regex(/^\d+(\.\d+)?$/)
      .openapi({ example: '25000', description: 'Human USDC notional' }),
    minTokenOut: z
      .string()
      .regex(/^\d+$/)
      .default('0')
      .openapi({ example: '0' }),
    maxSlippageBps: z.number().int().min(0).max(10000).default(100),
    exits: z.array(ExitRuleInputSchema).min(1).max(5),
    deadline: z.string().regex(/^\d+$/).openapi({
      description: 'Unix timestamp for EIP-712 OpenPosition deadline',
      example: '1735689600',
    }),
    nonce: z.string().regex(/^\d+$/).openapi({ example: '0' }),
    signature: z
      .string()
      .regex(/^0x[a-fA-F0-9]+$/)
      .openapi({ example: '0x' }),
  })
  .strict()
  .openapi('OpenPositionRequest')

export const SubmitTradeIntentInputSchema = OpenPositionRequestSchema.extend({
  agentId: agentIdParamSchema,
}).strict()

export const TradeIntentQuoteQuerySchema = z.object({
  symbol: z.string().min(1).optional().openapi({ example: 'NVDA' }),
})

export const TradeIntentQuoteSchema = z
  .object({
    agentId: agentIdParamSchema,
    vault: z.string(),
    signer: z.string(),
    nonce: z.string(),
    allocation: z.object({
      used: z.string(),
      cap: z.string(),
      available: z.string(),
    }),
    allowedSymbols: z.array(z.string()),
    defaultExit: z.array(ExitRuleInputSchema),
    eip712: z.object({
      domainName: z.string(),
      domainVersion: z.string(),
      chainId: z.number().int(),
      verifyingContract: z.string(),
      primaryType: z.literal('OpenPosition'),
    }),
    tradeRouter: z.string(),
    token: z.string().nullable().optional(),
  })
  .openapi('TradeIntentQuote')

export const SubmitTradeIntentResponseSchema = z
  .object({
    agentId: agentIdParamSchema,
    positionId: z.string(),
    transactionHash: z.string(),
  })
  .openapi('SubmitTradeIntentResponse')

export const AgentPositionSchema = z
  .object({
    positionId: z.string(),
    agentId: agentIdParamSchema,
    symbol: z.string(),
    token: z.string(),
    vault: z.string(),
    tokenAmount: z.string(),
    entryPriceUsdc: z.string(),
    usdcCostBasis: z.string(),
    maxSlippageBps: z.number().int(),
    status: z.enum(['Open', 'Closed']),
    nextRuleIndex: z.number().int(),
    openedAt: z.string(),
  })
  .openapi('AgentPosition')

export const ListAgentPositionsResponseSchema = z
  .object({
    agentId: agentIdParamSchema,
    positions: z.array(AgentPositionSchema),
  })
  .openapi('ListAgentPositionsResponse')

/** Legacy stub schema for routes still returning 501. */
export const LegacyTradeIntentRequestSchema = z
  .object({
    agentId: agentIdParamSchema.optional(),
    trackId: z.string().regex(/^\d+$/),
    action: z.enum(['swap', 'open', 'close']),
    inputAsset: z.string().min(1),
    outputAsset: z.string().min(1),
    amount: z.string().min(1),
    minOutputAmount: z.string().optional(),
    maxSlippageBps: z.number().int().optional(),
    venue: z.string().optional(),
    deadline: z.number().int(),
    nonce: z.number().int(),
    signature: z.string().regex(/^0x[a-fA-F0-9]+$/),
  })
  .strict()
  .openapi('LegacyTradeIntentRequest')

export const intentIdParamSchema = z
  .string()
  .uuid()
  .openapi({ example: '00000000-0000-4000-8000-000000000001' })

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

export type OpenPositionRequest = z.infer<typeof OpenPositionRequestSchema>
export type TradeIntentQuote = z.infer<typeof TradeIntentQuoteSchema>
export type SubmitTradeIntentResponse = z.infer<
  typeof SubmitTradeIntentResponseSchema
>
export type ListAgentPositionsResponse = z.infer<
  typeof ListAgentPositionsResponseSchema
>
