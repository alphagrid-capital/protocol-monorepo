import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import type { Context } from 'hono'
import { ROUTE_PATHS } from '../constants/routes.js'
import { AppError } from '../errors.js'
import { runLaunchWithPayment } from '../lib/agent/x402-registration.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import { requirePrivyAuth } from '../middleware/privy-auth.js'
import { PrivyAuthHeadersSchema } from '../schemas/auth-headers.js'
import {
  AgentDraftErrorSchema,
  AgentDraftListSchema,
  AgentDraftSchema,
  CreateAgentDraftSchema,
  draftIdParamSchema,
  LaunchAgentResponseSchema,
  ProvisionWalletResponseSchema,
  UpdateAgentDraftSchema,
} from '../schemas/agent-draft.js'
import { AgentDraftsService } from '../services/agent-drafts.service.js'
import { AgentDraftWalletService } from '../services/agent-draft-wallet.service.js'
import { AgentLaunchService } from '../services/agent-launch.service.js'

function handleDraftRouteError(c: Context, error: unknown): never {
  if (error instanceof AppError) {
    if (error.status === 400) {
      return c.json({ error: error.message }, 400) as never
    }
    if (error.status === 404) {
      return c.json({ error: error.message }, 404) as never
    }
    if (error.status === 502) {
      return c.json({ error: error.message }, 502) as never
    }
    if (error.status === 503) {
      return c.json({ error: error.message }, 503) as never
    }
  }
  throw error
}

const draftIdParam = z.object({
  draftId: draftIdParamSchema.openapi({
    param: { name: 'draftId', in: 'path' },
    example: 'draft_550e8400-e29b-41d4-a716-446655440000',
  }),
})

const authResponses = {
  401: {
    description: 'Missing or invalid Privy session',
    content: { 'application/json': { schema: AgentDraftErrorSchema } },
  },
  503: {
    description: 'Database or configuration not available',
    content: { 'application/json': { schema: AgentDraftErrorSchema } },
  },
}

const createDraftRoute = createRoute({
  method: 'post',
  path: ROUTE_PATHS.agentDrafts,
  tags: ['Agent drafts'],
  summary: 'Create agent launch draft',
  request: {
    headers: PrivyAuthHeadersSchema,
    body: { content: { 'application/json': { schema: CreateAgentDraftSchema } } },
  },
  responses: {
    201: {
      description: 'Draft created',
      content: { 'application/json': { schema: AgentDraftSchema } },
    },
    400: {
      description: 'Invalid identity or handle taken',
      content: { 'application/json': { schema: AgentDraftErrorSchema } },
    },
    ...authResponses,
  },
})

const updateDraftRoute = createRoute({
  method: 'put',
  path: ROUTE_PATHS.agentDraftById,
  tags: ['Agent drafts'],
  summary: 'Update agent launch draft',
  description:
    'Partial update. Same `identity` shape as create, plus optional `strategy` and `botFrequency` (`1h` or `1d` only). Launch requires identity, provisioned wallet, strategy, and bot frequency.',
  request: {
    headers: PrivyAuthHeadersSchema,
    params: draftIdParam,
    body: { content: { 'application/json': { schema: UpdateAgentDraftSchema } } },
  },
  responses: {
    200: {
      description: 'Draft updated',
      content: { 'application/json': { schema: AgentDraftSchema } },
    },
    400: {
      description: 'Invalid payload or handle taken',
      content: { 'application/json': { schema: AgentDraftErrorSchema } },
    },
    404: {
      description: 'Draft not found',
      content: { 'application/json': { schema: AgentDraftErrorSchema } },
    },
    ...authResponses,
  },
})

const getDraftRoute = createRoute({
  method: 'get',
  path: ROUTE_PATHS.agentDraftById,
  tags: ['Agent drafts'],
  summary: 'Get agent launch draft',
  request: {
    headers: PrivyAuthHeadersSchema,
    params: draftIdParam,
  },
  responses: {
    200: {
      description: 'Draft',
      content: { 'application/json': { schema: AgentDraftSchema } },
    },
    404: {
      description: 'Draft not found',
      content: { 'application/json': { schema: AgentDraftErrorSchema } },
    },
    ...authResponses,
  },
})

const listDraftsRoute = createRoute({
  method: 'get',
  path: ROUTE_PATHS.usersMeAgentDrafts,
  tags: ['Agent drafts'],
  summary: 'List in-progress agent launch drafts for authenticated user',
  request: {
    headers: PrivyAuthHeadersSchema,
  },
  responses: {
    200: {
      description: 'Draft list',
      content: { 'application/json': { schema: AgentDraftListSchema } },
    },
    ...authResponses,
  },
})

const deleteDraftRoute = createRoute({
  method: 'delete',
  path: ROUTE_PATHS.agentDraftById,
  tags: ['Agent drafts'],
  summary: 'Abandon agent launch draft',
  request: {
    headers: PrivyAuthHeadersSchema,
    params: draftIdParam,
  },
  responses: {
    204: { description: 'Draft abandoned' },
    404: {
      description: 'Draft not found',
      content: { 'application/json': { schema: AgentDraftErrorSchema } },
    },
    ...authResponses,
  },
})

const provisionWalletRoute = createRoute({
  method: 'post',
  path: ROUTE_PATHS.agentDraftProvisionWallet,
  tags: ['Agent drafts'],
  summary: 'Provision custodial agent signer wallet',
  request: {
    headers: PrivyAuthHeadersSchema,
    params: draftIdParam,
  },
  responses: {
    200: {
      description: 'Provisioned wallet addresses',
      content: {
        'application/json': { schema: ProvisionWalletResponseSchema },
      },
    },
    400: {
      description: 'Draft not ready for wallet provisioning',
      content: { 'application/json': { schema: AgentDraftErrorSchema } },
    },
    404: {
      description: 'Draft not found',
      content: { 'application/json': { schema: AgentDraftErrorSchema } },
    },
    ...authResponses,
  },
})

const launchDraftRoute = createRoute({
  method: 'post',
  path: ROUTE_PATHS.agentDraftLaunch,
  tags: ['Agent drafts'],
  summary: 'Launch agent from completed draft',
  description:
    'Signs SelfRegister with the custodial signer, collects x402 registration fee when configured, and registers on-chain with owner = authenticated wallet.',
  request: {
    headers: PrivyAuthHeadersSchema,
    params: draftIdParam,
  },
  responses: {
    200: {
      description: 'Launch submitted',
      content: {
        'application/json': { schema: LaunchAgentResponseSchema },
      },
    },
    400: {
      description: 'Draft incomplete or invalid',
      content: { 'application/json': { schema: AgentDraftErrorSchema } },
    },
    402: { description: 'x402 payment required' },
    404: {
      description: 'Draft not found',
      content: { 'application/json': { schema: AgentDraftErrorSchema } },
    },
    502: {
      description: 'On-chain registration failed',
      content: { 'application/json': { schema: AgentDraftErrorSchema } },
    },
    ...authResponses,
  },
})

export const agentDraftRoutes = new OpenAPIHono()

const privyProtectedDraftPaths = [
  ROUTE_PATHS.agentDrafts,
  ROUTE_PATHS.agentDraftById,
  ROUTE_PATHS.usersMeAgentDrafts,
  ROUTE_PATHS.agentDraftProvisionWallet,
  ROUTE_PATHS.agentDraftLaunch,
] as const

for (const path of privyProtectedDraftPaths) {
  agentDraftRoutes.use(path, requirePrivyAuth)
}

agentDraftRoutes.openapi(createDraftRoute, async (c) => {
  const body = c.req.valid('json')
  try {
    const draft = await AgentDraftsService.fromEnv(getWorkerEnv()).createDraft(
      c.get('authAddress'),
      body.identity
    )
    return c.json(draft, 201)
  } catch (error) {
    return handleDraftRouteError(c, error)
  }
})

agentDraftRoutes.openapi(updateDraftRoute, async (c) => {
  const { draftId } = c.req.valid('param')
  const body = c.req.valid('json')
  try {
    const draft = await AgentDraftsService.fromEnv(getWorkerEnv()).updateDraft(
      draftId,
      c.get('authAddress'),
      body
    )
    return c.json(draft, 200)
  } catch (error) {
    return handleDraftRouteError(c, error)
  }
})

agentDraftRoutes.openapi(getDraftRoute, async (c) => {
  const { draftId } = c.req.valid('param')
  try {
    const draft = await AgentDraftsService.fromEnv(getWorkerEnv()).getDraft(
      draftId,
      c.get('authAddress')
    )
    return c.json(draft, 200)
  } catch (error) {
    return handleDraftRouteError(c, error)
  }
})

agentDraftRoutes.openapi(listDraftsRoute, async (c) => {
  try {
    const drafts = await AgentDraftsService.fromEnv(getWorkerEnv()).listDrafts(
      c.get('authAddress')
    )
    return c.json({ drafts, total: drafts.length }, 200)
  } catch (error) {
    return handleDraftRouteError(c, error)
  }
})

agentDraftRoutes.openapi(deleteDraftRoute, async (c) => {
  const { draftId } = c.req.valid('param')
  try {
    await AgentDraftsService.fromEnv(getWorkerEnv()).abandonDraft(
      draftId,
      c.get('authAddress')
    )
    return c.body(null, 204)
  } catch (error) {
    return handleDraftRouteError(c, error)
  }
})

agentDraftRoutes.openapi(provisionWalletRoute, async (c) => {
  const { draftId } = c.req.valid('param')
  try {
    const wallet = await AgentDraftWalletService.fromEnv(
      getWorkerEnv()
    ).provisionWallet(draftId, c.get('authAddress'))
    return c.json(wallet, 200)
  } catch (error) {
    return handleDraftRouteError(c, error)
  }
})

agentDraftRoutes.openapi(launchDraftRoute, async (c) => {
  const { draftId } = c.req.valid('param')
  const env = getWorkerEnv()
  try {
    const payment = await runLaunchWithPayment({
      draftId,
      request: c.req.raw,
      env,
      handler: () =>
        AgentLaunchService.fromEnv(env).launchDraft(
          draftId,
          c.get('authAddress')
        ),
      toResponseBody: (value) => JSON.stringify(value),
    })

    if (!payment.ok) {
      return payment.response
    }

    return c.json(payment.value, 200)
  } catch (error) {
    return handleDraftRouteError(c, error)
  }
})
