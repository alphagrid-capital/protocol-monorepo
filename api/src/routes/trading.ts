import {
  createRoute,
  OpenAPIHono,
  z,
  type RouteHandler,
} from '@hono/zod-openapi'
import { AppError } from '../errors.js'
import { agentIdParamSchema } from '../schemas/agent.js'
import {
  intentIdParamSchema,
  LegacyTradeIntentRequestSchema,
  AddIntentQuoteSchema,
  AddPositionRequestSchema,
  ExitLadderIntentQuoteSchema,
  AgentRiskStateResponseSchema,
  GetAgentPositionResponseSchema,
  ListAgentPositionsResponseSchema,
  OpenPositionRequestSchema,
  PositionIntentQuoteQuerySchema,
  ReduceIntentQuoteSchema,
  ReducePositionRequestSchema,
  SubmitAdjustIntentResponseSchema,
  SubmitTradeIntentResponseSchema,
  TradeIntentQuoteQuerySchema,
  TradeIntentQuoteSchema,
  UpdateExitLadderRequestSchema,
  TradingErrorSchema,
  TradingNotImplementedSchema,
} from '../schemas/trading.js'
import { TradingError, TradingService } from '../services/trading.service.js'
import { getWorkerEnv } from '../lib/worker-env.js'

const tradingNotImplementedResponses = {
  501: {
    description: 'Trading API not yet implemented',
    content: {
      'application/json': {
        schema: TradingNotImplementedSchema,
      },
    },
  },
} as const

const tradingErrorResponses = {
  400: {
    description: 'Invalid trade intent or on-chain validation failed',
    content: { 'application/json': { schema: TradingErrorSchema } },
  },
  404: {
    description: 'Agent not found',
    content: { 'application/json': { schema: TradingErrorSchema } },
  },
  502: {
    description: 'On-chain submission failed',
    content: { 'application/json': { schema: TradingErrorSchema } },
  },
  503: {
    description: 'Trading or executor not configured',
    content: { 'application/json': { schema: TradingErrorSchema } },
  },
} as const

function statusFromTradingError(error: AppError): 400 | 404 | 502 | 503 {
  if (error.status === 404) {
    return 404
  }
  if (error.status === 400 || error.status === 502 || error.status === 503) {
    return error.status
  }
  return 503
}

const tradeIntentQuoteRoute = createRoute({
  method: 'get',
  path: '/agents/{agentId}/trade-intents/quote',
  tags: ['Trading'],
  summary: 'Trade intent signing quote',
  description:
    'Returns nonce, EIP-712 domain, vault, allocation headroom, and vault-allowed symbols for OpenPosition signing.',
  request: {
    params: z.object({
      agentId: agentIdParamSchema.openapi({
        param: { name: 'agentId', in: 'path' },
        example: '1',
      }),
    }),
    query: TradeIntentQuoteQuerySchema,
  },
  responses: {
    200: {
      description: 'Trade intent quote',
      content: {
        'application/json': { schema: TradeIntentQuoteSchema },
      },
    },
    ...tradingErrorResponses,
  },
})

const submitAgentTradeIntentRoute = createRoute({
  method: 'post',
  path: '/agents/{agentId}/trade-intents',
  tags: ['Trading'],
  summary: 'Submit agent trade intent',
  description:
    'Verifies an EIP-712 OpenPosition signature and relays TradeRouter.openPosition via the executor.',
  request: {
    params: z.object({
      agentId: agentIdParamSchema.openapi({
        param: { name: 'agentId', in: 'path' },
        example: '1',
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: OpenPositionRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Position opened',
      content: {
        'application/json': { schema: SubmitTradeIntentResponseSchema },
      },
    },
    ...tradingErrorResponses,
  },
})

const getAgentPositionsRoute = createRoute({
  method: 'get',
  path: '/agents/{agentId}/positions',
  tags: ['Trading'],
  summary: 'Agent open positions',
  description:
    'Reads open positions via PositionManager.getOpenPositionIds and multicall.',
  request: {
    params: z.object({
      agentId: agentIdParamSchema.openapi({
        param: { name: 'agentId', in: 'path' },
        example: '1',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Open positions',
      content: {
        'application/json': { schema: ListAgentPositionsResponseSchema },
      },
    },
    ...tradingErrorResponses,
  },
})

const agentIdParams = z.object({
  agentId: agentIdParamSchema.openapi({
    param: { name: 'agentId', in: 'path' },
    example: '1',
  }),
})

const positionIdParamSchema = z
  .string()
  .regex(/^\d+$/)
  .openapi({ example: '1' })

const getAgentPositionRoute = createRoute({
  method: 'get',
  path: '/agents/{agentId}/positions/{positionId}',
  tags: ['Trading'],
  summary: 'Agent position by id',
  description:
    'Reads a single position (open or closed) with realized or unrealized PnL.',
  request: {
    params: z.object({
      agentId: agentIdParamSchema.openapi({
        param: { name: 'agentId', in: 'path' },
        example: '1',
      }),
      positionId: positionIdParamSchema.openapi({
        param: { name: 'positionId', in: 'path' },
      }),
    }),
  },
  responses: {
    200: {
      description: 'Position details',
      content: {
        'application/json': { schema: GetAgentPositionResponseSchema },
      },
    },
    ...tradingErrorResponses,
  },
})

const addIntentQuoteRoute = createRoute({
  method: 'get',
  path: '/agents/{agentId}/add-intents/quote',
  tags: ['Trading'],
  summary: 'Add-to-position intent quote',
  request: { params: agentIdParams, query: PositionIntentQuoteQuerySchema },
  responses: {
    200: {
      description: 'Add intent quote',
      content: { 'application/json': { schema: AddIntentQuoteSchema } },
    },
    ...tradingErrorResponses,
  },
})

const submitAddIntentRoute = createRoute({
  method: 'post',
  path: '/agents/{agentId}/add-intents',
  tags: ['Trading'],
  summary: 'Submit add-to-position intent',
  request: {
    params: agentIdParams,
    body: {
      content: { 'application/json': { schema: AddPositionRequestSchema } },
    },
  },
  responses: {
    201: {
      description: 'Position increased',
      content: {
        'application/json': { schema: SubmitAdjustIntentResponseSchema },
      },
    },
    ...tradingErrorResponses,
  },
})

const reduceIntentQuoteRoute = createRoute({
  method: 'get',
  path: '/agents/{agentId}/reduce-intents/quote',
  tags: ['Trading'],
  summary: 'Reduce-position intent quote',
  request: { params: agentIdParams, query: PositionIntentQuoteQuerySchema },
  responses: {
    200: {
      description: 'Reduce intent quote',
      content: { 'application/json': { schema: ReduceIntentQuoteSchema } },
    },
    ...tradingErrorResponses,
  },
})

const submitReduceIntentRoute = createRoute({
  method: 'post',
  path: '/agents/{agentId}/reduce-intents',
  tags: ['Trading'],
  summary: 'Submit reduce-position intent',
  request: {
    params: agentIdParams,
    body: {
      content: { 'application/json': { schema: ReducePositionRequestSchema } },
    },
  },
  responses: {
    201: {
      description: 'Position reduced',
      content: {
        'application/json': { schema: SubmitAdjustIntentResponseSchema },
      },
    },
    ...tradingErrorResponses,
  },
})

const exitLadderIntentQuoteRoute = createRoute({
  method: 'get',
  path: '/agents/{agentId}/exit-ladder-intents/quote',
  tags: ['Trading'],
  summary: 'Update exit ladder intent quote',
  request: { params: agentIdParams, query: PositionIntentQuoteQuerySchema },
  responses: {
    200: {
      description: 'Exit ladder intent quote',
      content: {
        'application/json': { schema: ExitLadderIntentQuoteSchema },
      },
    },
    ...tradingErrorResponses,
  },
})

const submitExitLadderIntentRoute = createRoute({
  method: 'post',
  path: '/agents/{agentId}/exit-ladder-intents',
  tags: ['Trading'],
  summary: 'Submit update exit ladder intent',
  request: {
    params: agentIdParams,
    body: {
      content: {
        'application/json': { schema: UpdateExitLadderRequestSchema },
      },
    },
  },
  responses: {
    201: {
      description: 'Exit ladder updated',
      content: {
        'application/json': { schema: SubmitAdjustIntentResponseSchema },
      },
    },
    ...tradingErrorResponses,
  },
})

const submitTradeIntentRoute = createRoute({
  method: 'post',
  path: '/intents/trade',
  tags: ['Trading'],
  summary: 'Submit trade intent',
  description:
    'Planned global intent gateway entrypoint. Returns 501 until implemented.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: LegacyTradeIntentRequestSchema,
        },
      },
    },
  },
  responses: tradingNotImplementedResponses,
})

const getAgentTradesRoute = createRoute({
  method: 'get',
  path: '/agents/{agentId}/trades',
  tags: ['Trading'],
  summary: 'Agent trade history',
  description:
    'Planned indexed trade history for an agent. Returns 501 until the indexer is built.',
  request: {
    params: z.object({
      agentId: agentIdParamSchema.openapi({
        param: { name: 'agentId', in: 'path' },
        example: '1',
      }),
    }),
  },
  responses: tradingNotImplementedResponses,
})

const getAgentRiskStateRoute = createRoute({
  method: 'get',
  path: '/agents/{agentId}/risk-state',
  tags: ['Trading'],
  summary: 'Agent risk state',
  description:
    'On-chain v1: equity, drawdown, PnL, and advisory breach flags from TradeRouter views.',
  request: {
    params: z.object({
      agentId: agentIdParamSchema.openapi({
        param: { name: 'agentId', in: 'path' },
        example: '1',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Agent risk state',
      content: {
        'application/json': { schema: AgentRiskStateResponseSchema },
      },
    },
    ...tradingErrorResponses,
  },
})

const getIntentRoute = createRoute({
  method: 'get',
  path: '/intents/{intentId}',
  tags: ['Trading'],
  summary: 'Get trade intent status',
  description:
    'Planned intent lookup by id. Returns 501 until the intent gateway is built.',
  request: {
    params: z.object({
      intentId: intentIdParamSchema.openapi({
        param: { name: 'intentId', in: 'path' },
      }),
    }),
  },
  responses: tradingNotImplementedResponses,
})

export const tradingRoutes = new OpenAPIHono()

const tradeIntentQuoteHandler = async (
  c: Parameters<RouteHandler<typeof tradeIntentQuoteRoute>>[0]
) => {
  try {
    const symbol = c.req.query('symbol')
    const quote = await TradingService.fromEnv(getWorkerEnv()).getQuote(
      c.req.param('agentId'),
      symbol
    )
    return c.json(quote, 200)
  } catch (error) {
    if (error instanceof TradingError || error instanceof AppError) {
      return c.json({ error: error.message }, statusFromTradingError(error))
    }
    throw error
  }
}

const submitAgentTradeIntentHandler = async (
  c: Parameters<RouteHandler<typeof submitAgentTradeIntentRoute>>[0]
) => {
  try {
    const result = await TradingService.fromEnv(getWorkerEnv()).submitIntent(
      c.req.param('agentId'),
      c.req.valid('json')
    )
    return c.json(result, 201)
  } catch (error) {
    if (error instanceof TradingError || error instanceof AppError) {
      return c.json({ error: error.message }, statusFromTradingError(error))
    }
    throw error
  }
}

const getAgentPositionsHandler = async (
  c: Parameters<RouteHandler<typeof getAgentPositionsRoute>>[0]
) => {
  try {
    const result = await TradingService.fromEnv(
      getWorkerEnv()
    ).listOpenPositions(c.req.param('agentId'))
    return c.json(result, 200)
  } catch (error) {
    if (error instanceof TradingError || error instanceof AppError) {
      return c.json({ error: error.message }, statusFromTradingError(error))
    }
    throw error
  }
}

const getAgentPositionHandler = async (
  c: Parameters<RouteHandler<typeof getAgentPositionRoute>>[0]
) => {
  try {
    const result = await TradingService.fromEnv(getWorkerEnv()).getPosition(
      c.req.param('agentId'),
      c.req.param('positionId')
    )
    return c.json(result, 200)
  } catch (error) {
    if (error instanceof TradingError || error instanceof AppError) {
      return c.json({ error: error.message }, statusFromTradingError(error))
    }
    throw error
  }
}

const getAgentRiskStateHandler = async (
  c: Parameters<RouteHandler<typeof getAgentRiskStateRoute>>[0]
) => {
  try {
    const result = await TradingService.fromEnv(getWorkerEnv()).getRiskState(
      c.req.param('agentId')
    )
    return c.json(result, 200)
  } catch (error) {
    if (error instanceof TradingError || error instanceof AppError) {
      return c.json({ error: error.message }, statusFromTradingError(error))
    }
    throw error
  }
}

tradingRoutes.openapi(
  tradeIntentQuoteRoute,
  tradeIntentQuoteHandler as RouteHandler<typeof tradeIntentQuoteRoute>
)
tradingRoutes.openapi(
  submitAgentTradeIntentRoute,
  submitAgentTradeIntentHandler as RouteHandler<
    typeof submitAgentTradeIntentRoute
  >
)
tradingRoutes.openapi(
  getAgentPositionsRoute,
  getAgentPositionsHandler as RouteHandler<typeof getAgentPositionsRoute>
)
tradingRoutes.openapi(
  getAgentPositionRoute,
  getAgentPositionHandler as RouteHandler<typeof getAgentPositionRoute>
)

const addIntentQuoteHandler = async (
  c: Parameters<RouteHandler<typeof addIntentQuoteRoute>>[0]
) => {
  try {
    const positionId = c.req.query('positionId')
    if (!positionId) {
      return c.json({ error: 'positionId query parameter is required' }, 400)
    }
    const quote = await TradingService.fromEnv(getWorkerEnv()).getAddQuote(
      c.req.param('agentId'),
      positionId
    )
    return c.json(quote, 200)
  } catch (error) {
    if (error instanceof TradingError || error instanceof AppError) {
      return c.json({ error: error.message }, statusFromTradingError(error))
    }
    throw error
  }
}

const submitAddIntentHandler = async (
  c: Parameters<RouteHandler<typeof submitAddIntentRoute>>[0]
) => {
  try {
    const result = await TradingService.fromEnv(getWorkerEnv()).submitAddIntent(
      c.req.param('agentId'),
      c.req.valid('json')
    )
    return c.json(result, 201)
  } catch (error) {
    if (error instanceof TradingError || error instanceof AppError) {
      return c.json({ error: error.message }, statusFromTradingError(error))
    }
    throw error
  }
}

const reduceIntentQuoteHandler = async (
  c: Parameters<RouteHandler<typeof reduceIntentQuoteRoute>>[0]
) => {
  try {
    const positionId = c.req.query('positionId')
    if (!positionId) {
      return c.json({ error: 'positionId query parameter is required' }, 400)
    }
    const quote = await TradingService.fromEnv(getWorkerEnv()).getReduceQuote(
      c.req.param('agentId'),
      positionId
    )
    return c.json(quote, 200)
  } catch (error) {
    if (error instanceof TradingError || error instanceof AppError) {
      return c.json({ error: error.message }, statusFromTradingError(error))
    }
    throw error
  }
}

const submitReduceIntentHandler = async (
  c: Parameters<RouteHandler<typeof submitReduceIntentRoute>>[0]
) => {
  try {
    const result = await TradingService.fromEnv(
      getWorkerEnv()
    ).submitReduceIntent(c.req.param('agentId'), c.req.valid('json'))
    return c.json(result, 201)
  } catch (error) {
    if (error instanceof TradingError || error instanceof AppError) {
      return c.json({ error: error.message }, statusFromTradingError(error))
    }
    throw error
  }
}

const exitLadderIntentQuoteHandler = async (
  c: Parameters<RouteHandler<typeof exitLadderIntentQuoteRoute>>[0]
) => {
  try {
    const positionId = c.req.query('positionId')
    if (!positionId) {
      return c.json({ error: 'positionId query parameter is required' }, 400)
    }
    const quote = await TradingService.fromEnv(
      getWorkerEnv()
    ).getExitLadderQuote(c.req.param('agentId'), positionId)
    return c.json(quote, 200)
  } catch (error) {
    if (error instanceof TradingError || error instanceof AppError) {
      return c.json({ error: error.message }, statusFromTradingError(error))
    }
    throw error
  }
}

const submitExitLadderIntentHandler = async (
  c: Parameters<RouteHandler<typeof submitExitLadderIntentRoute>>[0]
) => {
  try {
    const result = await TradingService.fromEnv(
      getWorkerEnv()
    ).submitExitLadderIntent(c.req.param('agentId'), c.req.valid('json'))
    return c.json(result, 201)
  } catch (error) {
    if (error instanceof TradingError || error instanceof AppError) {
      return c.json({ error: error.message }, statusFromTradingError(error))
    }
    throw error
  }
}

tradingRoutes.openapi(
  addIntentQuoteRoute,
  addIntentQuoteHandler as RouteHandler<typeof addIntentQuoteRoute>
)
tradingRoutes.openapi(
  submitAddIntentRoute,
  submitAddIntentHandler as RouteHandler<typeof submitAddIntentRoute>
)
tradingRoutes.openapi(
  reduceIntentQuoteRoute,
  reduceIntentQuoteHandler as RouteHandler<typeof reduceIntentQuoteRoute>
)
tradingRoutes.openapi(
  submitReduceIntentRoute,
  submitReduceIntentHandler as RouteHandler<typeof submitReduceIntentRoute>
)
tradingRoutes.openapi(
  exitLadderIntentQuoteRoute,
  exitLadderIntentQuoteHandler as RouteHandler<
    typeof exitLadderIntentQuoteRoute
  >
)
tradingRoutes.openapi(
  submitExitLadderIntentRoute,
  submitExitLadderIntentHandler as RouteHandler<
    typeof submitExitLadderIntentRoute
  >
)

tradingRoutes.openapi(submitTradeIntentRoute, (c) =>
  c.json(TradingService.notImplemented(), 501)
)
tradingRoutes.openapi(getAgentTradesRoute, (c) =>
  c.json(TradingService.notImplemented(), 501)
)
tradingRoutes.openapi(
  getAgentRiskStateRoute,
  getAgentRiskStateHandler as RouteHandler<typeof getAgentRiskStateRoute>
)
tradingRoutes.openapi(getIntentRoute, (c) =>
  c.json(TradingService.notImplemented(), 501)
)
