import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  agentIdParamSchema,
  AgentNotFoundSchema,
  AgentRegistrationQuoteSchema,
  AgentRegistrationRequestSchema,
  AgentRegistrationResponseSchema,
  erc8004AgentIdParamSchema,
  GetAgentResponseSchema,
  LinkErc8004RequestSchema,
  LinkErc8004ResponseSchema,
  ListAgentsByOwnerResponseSchema,
} from '../schemas/agent.js'
import {
  AgentRegistrationService,
  AgentRegistrationError,
} from '../services/agent-registration.service.js'
import { createRegistrationPaymentMiddleware } from '../lib/agent/x402-registration.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import { AppError } from '../errors.js'

const getAgentByErc8004Route = createRoute({
  method: 'get',
  path: '/agents/by-erc8004/{erc8004AgentId}',
  tags: ['Agents'],
  summary: 'Get agent by ERC-8004 identity',
  description:
    'Reads AgentRegistry via `getAgentByERC8004(uint256)`. Returns 404 when no agent is linked to the token id.',
  request: {
    params: z.object({
      erc8004AgentId: erc8004AgentIdParamSchema.openapi({
        param: { name: 'erc8004AgentId', in: 'path' },
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
      description: 'ERC-8004 identity not linked to any agent',
      content: { 'application/json': { schema: AgentNotFoundSchema } },
    },
    503: { description: 'Registry or RPC not configured' },
  },
})

const linkErc8004Route = createRoute({
  method: 'post',
  path: '/agents/{agentId}/erc8004/link',
  tags: ['Agents'],
  summary: 'Link ERC-8004 identity to agent',
  description:
    'Submits `linkERC8004Identity` via the registrar relayer. Agent owner must hold the ERC-8004 NFT on-chain.',
  request: {
    params: z.object({
      agentId: agentIdParamSchema.openapi({
        param: { name: 'agentId', in: 'path' },
        example: '1',
      }),
    }),
    body: {
      content: {
        'application/json': { schema: LinkErc8004RequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'ERC-8004 identity linked',
      content: {
        'application/json': { schema: LinkErc8004ResponseSchema },
      },
    },
    400: { description: 'Invalid link request or on-chain revert' },
    404: { description: 'Agent not found' },
    502: { description: 'On-chain link transaction failed' },
    503: { description: 'Relayer or registry not configured' },
  },
})

const listAgentsByOwnerRoute = createRoute({
  method: 'get',
  path: '/agents/by-owner/{owner}',
  tags: ['Agents'],
  summary: 'List agents by owner',
  description:
    'Reads AgentRegistry via `agentCountByOwner` and `agentIdByOwnerAt`, then loads each record with `getAgent`. Returns current ownership only.',
  request: {
    params: z.object({
      owner: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, 'Expected 0x-prefixed 20-byte address')
        .openapi({
          param: { name: 'owner', in: 'path' },
          example: '0x0000000000000000000000000000000000000001',
        }),
    }),
  },
  responses: {
    200: {
      description: 'Agents owned by the address',
      content: {
        'application/json': { schema: ListAgentsByOwnerResponseSchema },
      },
    },
    400: { description: 'Invalid owner address' },
    503: { description: 'Registry or RPC not configured' },
  },
})

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

agentRoutes.openapi(getAgentByErc8004Route, async (c) => {
  try {
    const result = await AgentRegistrationService.fromEnv(
      getWorkerEnv()
    ).getAgentByErc8004(c.req.param('erc8004AgentId'))
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

agentRoutes.openapi(listAgentsByOwnerRoute, async (c) => {
  try {
    const result = await AgentRegistrationService.fromEnv(
      getWorkerEnv()
    ).listAgentsByOwner(c.req.param('owner') as `0x${string}`)
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

// TODO: rate-limit linkERC8004 requests per IP/signer/agentId (Cloudflare or in-worker)
agentRoutes.openapi(linkErc8004Route, async (c) => {
  try {
    const result = await AgentRegistrationService.fromEnv(
      getWorkerEnv()
    ).linkErc8004(c.req.param('agentId'), c.req.valid('json'))
    return c.json(result, 200)
  } catch (error) {
    if (error instanceof AppError || error instanceof AgentRegistrationError) {
      return c.json({ error: error.message }, statusFromError(error))
    }
    throw error
  }
})
