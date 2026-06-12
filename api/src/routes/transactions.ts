import {
  createRoute,
  OpenAPIHono,
  z,
  type RouteHandler,
} from '@hono/zod-openapi'
import { AppError } from '../errors.js'
import {
  TransactionStatusResponseSchema,
  txHashParamSchema,
} from '../schemas/transaction.js'
import {
  TransactionError,
  TransactionService,
} from '../services/transaction.service.js'
import { getWorkerEnv } from '../lib/worker-env.js'

const TransactionErrorSchema = z
  .object({
    error: z.string(),
  })
  .openapi('TransactionError')

const getTransactionRoute = createRoute({
  method: 'get',
  path: '/transactions/{txHash}',
  tags: ['Trading'],
  summary: 'Transaction status',
  description:
    'Looks up an on-chain transaction receipt by hash. Use after intent submit to confirm execution.',
  request: {
    params: z.object({
      txHash: txHashParamSchema.openapi({
        param: { name: 'txHash', in: 'path' },
      }),
    }),
  },
  responses: {
    200: {
      description: 'Transaction status',
      content: {
        'application/json': { schema: TransactionStatusResponseSchema },
      },
    },
    404: {
      description: 'Transaction not found',
      content: { 'application/json': { schema: TransactionErrorSchema } },
    },
    503: {
      description: 'RPC not configured',
      content: { 'application/json': { schema: TransactionErrorSchema } },
    },
  },
})

export const transactionRoutes = new OpenAPIHono()

const getTransactionHandler = async (
  c: Parameters<RouteHandler<typeof getTransactionRoute>>[0]
) => {
  try {
    const result = await TransactionService.fromEnv(getWorkerEnv()).getStatus(
      c.req.param('txHash') as `0x${string}`
    )
    return c.json(result, 200)
  } catch (error) {
    if (error instanceof TransactionError || error instanceof AppError) {
      if (error.status === 404) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: error.message }, 503)
    }
    throw error
  }
}

transactionRoutes.openapi(
  getTransactionRoute,
  getTransactionHandler as RouteHandler<typeof getTransactionRoute>
)
