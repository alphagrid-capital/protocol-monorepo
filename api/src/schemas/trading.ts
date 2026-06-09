import { z } from '@hono/zod-openapi'
import { agentIdParamSchema } from './agent.js'
import { AccountRiskBoundsSchema, ExitBoundsSchema } from './vault.js'

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
    trackId: z.number().int(),
    exitBounds: ExitBoundsSchema,
    accountRiskBounds: AccountRiskBoundsSchema,
    dailyRealizedPnlUsdc: z.string().openapi({
      description: 'Net realized PnL today (negative = loss); from TradeRouter.dailyRealizedPnlUsdc',
      example: '0',
    }),
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
    exitRules: z.array(ExitRuleInputSchema),
    pendingRules: z.array(ExitRuleInputSchema),
    openedAt: z.string(),
  })
  .openapi('AgentPosition')

const positionIntentQuoteFields = {
  agentId: agentIdParamSchema,
  positionId: z.string(),
  signer: z.string(),
  nonce: z.string(),
  eip712: z.object({
    domainName: z.string(),
    domainVersion: z.string(),
    chainId: z.number().int(),
    verifyingContract: z.string(),
    primaryType: z.string(),
  }),
  tradeRouter: z.string(),
}

export const PositionIntentQuoteQuerySchema = z.object({
  positionId: z.string().regex(/^\d+$/).openapi({ example: '1' }),
})

export const AddIntentQuoteSchema = z
  .object({
    ...positionIntentQuoteFields,
    allocation: z.object({
      used: z.string(),
      cap: z.string(),
      available: z.string(),
    }),
    position: AgentPositionSchema.omit({ exitRules: true, pendingRules: true }),
    eip712: positionIntentQuoteFields.eip712.extend({
      primaryType: z.literal('AddToPosition'),
    }),
  })
  .openapi('AddIntentQuote')

export const ReduceIntentQuoteSchema = z
  .object({
    ...positionIntentQuoteFields,
    position: AgentPositionSchema,
    eip712: positionIntentQuoteFields.eip712.extend({
      primaryType: z.literal('ReducePosition'),
    }),
  })
  .openapi('ReduceIntentQuote')

export const ExitLadderIntentQuoteSchema = z
  .object({
    ...positionIntentQuoteFields,
    exitBounds: ExitBoundsSchema,
    currentRules: z.array(ExitRuleInputSchema),
    pendingRules: z.array(ExitRuleInputSchema),
    nextRuleIndex: z.number().int(),
    eip712: positionIntentQuoteFields.eip712.extend({
      primaryType: z.literal('UpdateExitLadder'),
    }),
  })
  .openapi('ExitLadderIntentQuote')

const signedIntentFields = {
  positionId: z.string().regex(/^\d+$/),
  deadline: z.string().regex(/^\d+$/),
  nonce: z.string().regex(/^\d+$/),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/),
}

export const AddPositionRequestSchema = z
  .object({
    ...signedIntentFields,
    usdcAmount: z.string().regex(/^\d+(\.\d+)?$/),
    minTokenOut: z.string().regex(/^\d+$/).default('0'),
    maxSlippageBps: z.number().int().min(0).max(10000).default(100),
  })
  .strict()
  .openapi('AddPositionRequest')

export const ReducePositionRequestSchema = z
  .object({
    ...signedIntentFields,
    exitBps: z.number().int().min(1).max(10000),
  })
  .strict()
  .openapi('ReducePositionRequest')

export const UpdateExitLadderRequestSchema = z
  .object({
    ...signedIntentFields,
    exits: z.array(ExitRuleInputSchema).min(1).max(5),
  })
  .strict()
  .openapi('UpdateExitLadderRequest')

export const SubmitAdjustIntentResponseSchema = z
  .object({
    agentId: agentIdParamSchema,
    positionId: z.string(),
    transactionHash: z.string(),
  })
  .openapi('SubmitAdjustIntentResponse')

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

export const PositionAdjustInputSchema = GetAgentTradingInputSchema.extend({
  positionId: z.string().regex(/^\d+$/),
}).strict()

export const SubmitAddIntentInputSchema = AddPositionRequestSchema.extend({
  agentId: agentIdParamSchema,
}).strict()

export const SubmitReduceIntentInputSchema =
  ReducePositionRequestSchema.extend({
    agentId: agentIdParamSchema,
  }).strict()

export const SubmitExitLadderIntentInputSchema =
  UpdateExitLadderRequestSchema.extend({
    agentId: agentIdParamSchema,
  }).strict()

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
export type AddPositionRequest = z.infer<typeof AddPositionRequestSchema>
export type ReducePositionRequest = z.infer<typeof ReducePositionRequestSchema>
export type UpdateExitLadderRequest = z.infer<
  typeof UpdateExitLadderRequestSchema
>
export type SubmitAdjustIntentResponse = z.infer<
  typeof SubmitAdjustIntentResponseSchema
>
