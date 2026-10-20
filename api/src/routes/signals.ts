import type { Context } from 'hono'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { RouteHandler } from '@hono/zod-openapi'
import { ROUTE_PATHS } from '../constants/routes.js'
import { AppError } from '../errors.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import { requirePrivyAuth } from '../middleware/privy-auth.js'
import { PrivyAuthHeadersSchema } from '../schemas/auth-headers.js'
import {
  PreviewEquityNewsBodySchema,
  PreviewFredBodySchema,
  PreviewTruthSocialBodySchema,
  SignalPreviewErrorSchema,
  SignalPreviewResponseSchema,
} from '../schemas/signals.js'
import { createSignalsService } from '../services/signals.service.js'

const signalRoutes = new OpenAPIHono()

const privyProtectedPaths = [
  ROUTE_PATHS.signalsPreviewTruthSocial,
  ROUTE_PATHS.signalsPreviewEquityNews,
  ROUTE_PATHS.signalsPreviewFred,
] as const

for (const path of privyProtectedPaths) {
  signalRoutes.use(path, requirePrivyAuth)
}

function handleSignalPreviewError(c: Context, error: unknown): never {
  if (error instanceof AppError) {
    if (error.status === 400) {
      return c.json({ error: error.message }, 400) as never
    }
  }
  throw error
}

const previewTruthSocialRoute = createRoute({
  method: 'post',
  path: ROUTE_PATHS.signalsPreviewTruthSocial,
  tags: ['Signals'],
  summary: 'Preview Truth Social signals',
  description:
    'Fetches a Truth Social feed for the given username without requiring a saved agent. Uses the signals cache when fresh. Requires Privy auth.',
  security: [{ bearerAuth: [] }],
  request: {
    headers: PrivyAuthHeadersSchema,
    body: {
      content: {
        'application/json': { schema: PreviewTruthSocialBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Preview feed (null when unavailable)',
      content: {
        'application/json': { schema: SignalPreviewResponseSchema },
      },
    },
    400: {
      description: 'Invalid preview request',
      content: { 'application/json': { schema: SignalPreviewErrorSchema } },
    },
    401: {
      description: 'Missing or invalid Privy session',
      content: { 'application/json': { schema: SignalPreviewErrorSchema } },
    },
  },
})

const previewEquityNewsRoute = createRoute({
  method: 'post',
  path: ROUTE_PATHS.signalsPreviewEquityNews,
  tags: ['Signals'],
  summary: 'Preview equity news signals',
  description:
    'Fetches recent equity / company news for the given symbols without requiring a saved agent. Symbols are required for preview. Uses the signals cache when fresh. Requires Privy auth.',
  security: [{ bearerAuth: [] }],
  request: {
    headers: PrivyAuthHeadersSchema,
    body: {
      content: {
        'application/json': { schema: PreviewEquityNewsBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Preview feed (null when unavailable)',
      content: {
        'application/json': { schema: SignalPreviewResponseSchema },
      },
    },
    400: {
      description: 'Invalid preview request',
      content: { 'application/json': { schema: SignalPreviewErrorSchema } },
    },
    401: {
      description: 'Missing or invalid Privy session',
      content: { 'application/json': { schema: SignalPreviewErrorSchema } },
    },
  },
})

const previewFredRoute = createRoute({
  method: 'post',
  path: ROUTE_PATHS.signalsPreviewFred,
  tags: ['Signals'],
  summary: 'Preview FRED macro signals',
  description:
    'Fetches latest FRED macro observations for the given series ids (or the default US macro set when omitted). Does not require a saved agent. Uses the signals cache when fresh. Requires Privy auth.',
  security: [{ bearerAuth: [] }],
  request: {
    headers: PrivyAuthHeadersSchema,
    body: {
      content: {
        'application/json': { schema: PreviewFredBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Preview feed (null when unavailable)',
      content: {
        'application/json': { schema: SignalPreviewResponseSchema },
      },
    },
    400: {
      description: 'Invalid preview request',
      content: { 'application/json': { schema: SignalPreviewErrorSchema } },
    },
    401: {
      description: 'Missing or invalid Privy session',
      content: { 'application/json': { schema: SignalPreviewErrorSchema } },
    },
  },
})

const previewTruthSocialHandler: RouteHandler<
  typeof previewTruthSocialRoute
> = async (c) => {
  try {
    const { username } = c.req.valid('json')
    const feed = await createSignalsService(getWorkerEnv()).loadTruthSocial(
      username
    )
    return c.json({ feed }, 200)
  } catch (error) {
    return handleSignalPreviewError(c, error)
  }
}

const previewEquityNewsHandler: RouteHandler<
  typeof previewEquityNewsRoute
> = async (c) => {
  try {
    const { symbols } = c.req.valid('json')
    const feed = await createSignalsService(getWorkerEnv()).loadEquityNews(
      symbols
    )
    return c.json({ feed }, 200)
  } catch (error) {
    return handleSignalPreviewError(c, error)
  }
}

const previewFredHandler: RouteHandler<typeof previewFredRoute> = async (c) => {
  try {
    const { seriesIds } = c.req.valid('json')
    const feed = await createSignalsService(getWorkerEnv()).loadFred(
      seriesIds ?? []
    )
    return c.json({ feed }, 200)
  } catch (error) {
    return handleSignalPreviewError(c, error)
  }
}

signalRoutes.openapi(previewTruthSocialRoute, previewTruthSocialHandler)
signalRoutes.openapi(previewEquityNewsRoute, previewEquityNewsHandler)
signalRoutes.openapi(previewFredRoute, previewFredHandler)

export { signalRoutes }
