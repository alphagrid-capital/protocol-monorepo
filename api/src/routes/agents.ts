import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  agentIdParamSchema,
  AgentNotFoundSchema,
  AgentRegistrationQuoteSchema,
  AgentRegistrationRequestSchema,
  AgentRegistrationResponseSchema,
  GetAgentResponseSchema,
} from '../schemas/agent.js'
import {
  AgentRegistrationService,
  AgentRegistrationError,
} from '../services/agent-registration.service.js'
import { createRegistrationPaymentMiddleware } from '../lib/x402-agent-registration.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import { AppError } from '../errors.js'

const getAgentRoute = createRoute({
  method: 'get',
  path: '/agents/{agentId}',
  tags: ['Agents'],
  summary: 'Get agent by id',
  description:
    'Reads the on-chain AgentRegistry record via `getAgent(uint256)`. Requires a deployed registry and RPC_URL.',
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
      description: 'Agent record',
      content: {
        'application/json': { schema: GetAgentResponseSchema },
      },
    },
    404: {
      description: 'Agent not found',
      content: { 'application/json': { schema: AgentNotFoundSchema } },
    },
    503: { description: 'Registry or RPC not configured' },
  },
})

const quoteRoute = createRoute({
  method: 'get',
  path: '/agents/register/quote',
  tags: ['Agents'],
  summary: 'Agent registration quote',
  description:
    'Returns EIP-712 domain data, registration fee, and x402 payment requirements for backend-mediated registration on AgentRegistry.',
  request: {
    query: z.object({
      signer: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/)
        .optional()
        .openapi({
          description:
            'Optional signer address to read the current registration nonce',
        }),
    }),
  },
  responses: {
    200: {
      description: 'Registration quote',
      content: { 'application/json': { schema: AgentRegistrationQuoteSchema } },
    },
  },
})

const registerRoute = createRoute({
  method: 'post',
  path: '/agents/register',
  tags: ['Agents'],
  summary: 'Register agent (x402 + AgentRegistry)',
  description:
    'Register an agent on AgentRegistry through the backend registrar. Requires a valid EIP-712 SelfRegister signature. ' +
    'When x402 is enabled, the registration fee is collected via HTTP 402 (USDC) and the relayer submits registerAgent in the same request.',
  request: {
    body: {
      content: {
        'application/json': { schema: AgentRegistrationRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Registration accepted',
      content: {
        'application/json': { schema: AgentRegistrationResponseSchema },
      },
    },
    400: { description: 'Invalid request or signature' },
    402: { description: 'x402 payment required' },
    502: { description: 'On-chain registration failed' },
    503: { description: 'Server or relayer configuration error' },
  },
  middleware: createRegistrationPaymentMiddleware(),
})

export const agentRoutes = new OpenAPIHono()

function statusFromError(error: AppError): 400 | 402 | 404 | 502 | 503 {
  if (error.status === 404) {
    return 404
  }
  if (
    error.status === 400 ||
    error.status === 402 ||
    error.status === 502 ||
    error.status === 503
  ) {
    return error.status
  }
  return 503
}

agentRoutes.openapi(quoteRoute, async (c) => {
  const signer = c.req.query('signer') as `0x${string}` | undefined
  const quote =
    await AgentRegistrationService.fromEnv(getWorkerEnv()).getQuote(signer)
  return c.json(quote, 200)
})

agentRoutes.openapi(registerRoute, async (c) => {
  try {
    const body = c.req.valid('json')
    const result =
      await AgentRegistrationService.fromEnv(getWorkerEnv()).register(body)
    return c.json(result, 200)
  } catch (error) {
    if (error instanceof AppError || error instanceof AgentRegistrationError) {
      return c.json({ error: error.message }, statusFromError(error))
    }
    throw error
  }
})

agentRoutes.openapi(getAgentRoute, async (c) => {
  try {
    const result = await AgentRegistrationService.fromEnv(
      getWorkerEnv()
    ).getAgent(c.req.param('agentId'))
    return c.json(result, 200, {
      'Cache-Control': 'public, max-age=15',
    })
  } catch (error) {
    if (error instanceof AppError || error instanceof AgentRegistrationError) {
      return c.json({ error: error.message }, statusFromError(error))
    }
    throw error
  }
})
