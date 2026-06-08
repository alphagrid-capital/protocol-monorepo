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
  ListAgentPositionsResponseSchema,
  OpenPositionRequestSchema,
  SubmitTradeIntentResponseSchema,
  TradeIntentQuoteQuerySchema,
  TradeIntentQuoteSchema,
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
    'Reads open positions from PositionManager via RPC (catalog token scan).',
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
    'Planned drawdown, turnover, and breach flags for an agent. Returns 501 until the risk engine is built.',
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

tradingRoutes.openapi(submitTradeIntentRoute, (c) =>
  c.json(TradingService.notImplemented(), 501)
)
tradingRoutes.openapi(getAgentTradesRoute, (c) =>
  c.json(TradingService.notImplemented(), 501)
)
tradingRoutes.openapi(getAgentRiskStateRoute, (c) =>
  c.json(TradingService.notImplemented(), 501)
)
tradingRoutes.openapi(getIntentRoute, (c) =>
  c.json(TradingService.notImplemented(), 501)
)
