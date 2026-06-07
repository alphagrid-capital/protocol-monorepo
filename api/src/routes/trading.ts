import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { agentIdParamSchema } from '../schemas/agent.js'
import {
  intentIdParamSchema,
  TradeIntentRequestSchema,
  TradingNotImplementedSchema,
} from '../schemas/trading.js'
import { TradingService } from '../services/trading.service.js'

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

const submitAgentTradeIntentRoute = createRoute({
  method: 'post',
  path: '/agents/{agentId}/trade-intents',
  tags: ['Trading'],
  summary: 'Submit agent trade intent',
  description:
    'Planned intent gateway entrypoint for agent-signed trade intents. Returns 501 until the executor is wired.',
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
          schema: TradeIntentRequestSchema,
        },
      },
    },
  },
  responses: tradingNotImplementedResponses,
})

const submitTradeIntentRoute = createRoute({
  method: 'post',
  path: '/intents/trade',
  tags: ['Trading'],
  summary: 'Submit trade intent',
  description:
    'Planned global intent gateway entrypoint. Returns 501 until the executor is wired.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: TradeIntentRequestSchema,
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
  description: 'Planned indexed trade history for an agent. Returns 501 until the indexer is built.',
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

const getAgentPositionsRoute = createRoute({
  method: 'get',
  path: '/agents/{agentId}/positions',
  tags: ['Trading'],
  summary: 'Agent open positions',
  description: 'Planned on-chain position reads for an agent. Returns 501 until the indexer is built.',
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
  description: 'Planned intent lookup by id. Returns 501 until the intent gateway is built.',
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

tradingRoutes.openapi(submitAgentTradeIntentRoute, (c) =>
  c.json(TradingService.notImplemented(), 501)
)
tradingRoutes.openapi(submitTradeIntentRoute, (c) =>
  c.json(TradingService.notImplemented(), 501)
)
tradingRoutes.openapi(getAgentTradesRoute, (c) =>
  c.json(TradingService.notImplemented(), 501)
)
tradingRoutes.openapi(getAgentPositionsRoute, (c) =>
  c.json(TradingService.notImplemented(), 501)
)
tradingRoutes.openapi(getAgentRiskStateRoute, (c) =>
  c.json(TradingService.notImplemented(), 501)
)
tradingRoutes.openapi(getIntentRoute, (c) =>
  c.json(TradingService.notImplemented(), 501)
)
