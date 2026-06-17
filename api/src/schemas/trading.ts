import { z } from '@hono/zod-openapi'
import { agentIdParamSchema } from './agent.js'
import { AccountRiskBoundsSchema, ExitBoundsSchema } from './vault.js'

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
      description:
        'Net realized PnL today (negative = loss); from TradeRouter.dailyRealizedPnlUsdc',
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

export const PositionDerivedSchema = z
  .object({
    totalPnlUsdc: z.string(),
    returnBps: z.number().int().nullable(),
  })
  .openapi('PositionDerived')

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
    unrealizedPnlUsdc: z.string().optional().openapi({
      description: 'Mark-to-market unrealized PnL (open positions)',
    }),
    derived: PositionDerivedSchema,
  })
  .openapi('AgentPosition')

export const AgentPositionDetailSchema = AgentPositionSchema.extend({
  realizedPnlUsdc: z
    .string()
    .optional()
    .openapi({ description: 'Cumulative realized PnL (closed positions)' }),
}).openapi('AgentPositionDetail')

export const GetAgentPositionResponseSchema = z
  .object({
    agentId: agentIdParamSchema,
    position: AgentPositionDetailSchema,
  })
  .openapi('GetAgentPositionResponse')

export const RiskStateDerivedSchema = z
  .object({
    returnBps: z
      .number()
      .int()
      .nullable()
      .openapi({ description: 'Account return vs allocation cap (bps)' }),
    unrealizedPnlUsdc: z.string(),
    drawdownUtilizationBps: z.number().int().nullable(),
    maxDailyLossUsdc: z.string(),
    dailyLossUsedUsdc: z.string(),
    dailyLossUtilizationBps: z.number().int().nullable(),
  })
  .openapi('RiskStateDerived')

export const PromotionReadinessSchema = z
  .object({
    minTradesRequired: z.number().int(),
    tradesCompleted: z.number().int(),
    meetsMinTrades: z.boolean(),
    evaluationPeriodSeconds: z.string(),
    evaluationElapsedSeconds: z.string(),
    meetsEvaluationPeriod: z.boolean(),
    promotionScoreRequired: z.number().int(),
    alphaScore: z.null(),
    meetsAlphaScore: z.null(),
    eligible: z.boolean(),
    blockers: z.array(z.string()),
  })
  .openapi('PromotionReadiness')

export const AgentRiskStateResponseSchema = z
  .object({
    agentId: agentIdParamSchema,
    trackId: z.number().int(),
    allocation: z.object({
      cap: z.string(),
      used: z.string(),
      available: z.string(),
    }),
    accountRiskBounds: AccountRiskBoundsSchema,
    equity: z.object({
      peakUsdc: z.string(),
      currentUsdc: z.string(),
      currentDrawdownBps: z.number().int(),
    }),
    pnl: z.object({
      lifetimeRealizedUsdc: z.string(),
      dailyRealizedUsdc: z.string(),
      day: z.string(),
    }),
    positions: z.object({
      opened: z.number().int(),
      closed: z.number().int(),
      openCount: z.number().int(),
    }),
    breaches: z.object({
      drawdown: z.boolean(),
      dailyLoss: z.boolean(),
    }),
    derived: RiskStateDerivedSchema,
    promotionReadiness: PromotionReadinessSchema,
  })
  .openapi('AgentRiskStateResponse')

export const ListClosedPositionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
})

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

export const AgentTradeActivityTypeSchema = z.enum([
  'PositionOpened',
  'PositionIncreased',
  'PositionReduced',
  'ExitLadderUpdated',
  'ExitExecuted',
  'PositionForceClosed',
  'PositionClosed',
])

export const AgentTradeActivitySchema = z
  .object({
    type: AgentTradeActivityTypeSchema,
    positionId: z.string(),
    blockNumber: z.string(),
    transactionHash: z.string(),
    timestamp: z.string().openapi({
      description: 'Block timestamp (unix seconds)',
    }),
    logIndex: z.number().int(),
    source: z.enum(['TradeRouter', 'PositionManager']),
    vault: z.string().optional(),
    token: z.string().optional(),
    symbol: z.string().optional(),
    usdcIn: z.string().optional(),
    usdcOut: z.string().optional(),
    tokensAdded: z.string().optional(),
    exitBps: z.number().int().optional(),
    ruleIndex: z.number().int().optional(),
    nextRuleIndex: z.number().int().optional(),
    keeper: z.string().optional(),
    keeperBounty: z.string().optional(),
    operator: z.string().optional(),
    realizedPnlUsdc: z.string().optional(),
  })
  .openapi('AgentTradeActivity')

export const ListAgentTradesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
  fromBlock: z.string().regex(/^\d+$/).optional().openapi({
    description:
      'Optional lower block bound for log scan (defaults to chain trading deploy block)',
    example: '276471279',
  }),
})

export const ListAgentTradesResponseSchema = z
  .object({
    agentId: agentIdParamSchema,
    source: z.enum(['on-chain-events', 'indexed']).openapi({
      description:
        'Activity feed source: indexed subgraph or on-chain event log scan fallback',
    }),
    scannedFromBlock: z.string().optional().openapi({
      description: 'Lower block bound used for RPC log scan fallback',
    }),
    indexedThroughBlock: z.string().optional().openapi({
      description: 'Latest indexed block when source is indexed',
    }),
    trades: z.array(AgentTradeActivitySchema),
  })
  .openapi('ListAgentTradesResponse')

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

export const SubmitReduceIntentInputSchema = ReducePositionRequestSchema.extend(
  {
    agentId: agentIdParamSchema,
  }
).strict()

export const SubmitExitLadderIntentInputSchema =
  UpdateExitLadderRequestSchema.extend({
    agentId: agentIdParamSchema,
  }).strict()

export type OpenPositionRequest = z.infer<typeof OpenPositionRequestSchema>
export type TradeIntentQuote = z.infer<typeof TradeIntentQuoteSchema>
export type SubmitTradeIntentResponse = z.infer<
  typeof SubmitTradeIntentResponseSchema
>
export type ListAgentPositionsResponse = z.infer<
  typeof ListAgentPositionsResponseSchema
>
export type AgentRiskStateResponse = z.infer<
  typeof AgentRiskStateResponseSchema
>
export type GetAgentPositionResponse = z.infer<
  typeof GetAgentPositionResponseSchema
>
export type AddPositionRequest = z.infer<typeof AddPositionRequestSchema>
export type ReducePositionRequest = z.infer<typeof ReducePositionRequestSchema>
export type UpdateExitLadderRequest = z.infer<
  typeof UpdateExitLadderRequestSchema
>
export type SubmitAdjustIntentResponse = z.infer<
  typeof SubmitAdjustIntentResponseSchema
>
export type ListAgentTradesResponse = z.infer<
  typeof ListAgentTradesResponseSchema
>
