import { swaggerUI } from '@hono/swagger-ui'
import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { PRIVY_ID_TOKEN_HEADER } from './schemas/auth-headers.js'
import { openApiJsonResponse } from './openapi.js'
import { authRoutes } from './routes/auth.js'
import { registerDiscoveryRoutes } from './routes/discovery.js'
import { agentRoutes } from './routes/agents.js'
import { healthRoutes } from './routes/health.js'
import { tokenRoutes } from './routes/tokens.js'
import { tradingRoutes } from './routes/trading.js'
import { transactionRoutes } from './routes/transactions.js'
import { userRoutes } from './routes/users.js'
import { vaultRoutes } from './routes/vaults.js'
import type { WorkerEnv } from './types/worker-env.js'

function isSwaggerEnabled(env: WorkerEnv): boolean {
  const raw = env.ENABLE_SWAGGER as string | boolean | undefined
  if (raw === true) {
    return true
  }
  if (raw === false) {
    return false
  }
  const value = String(raw ?? 'true').toLowerCase()
  return value === '1' || value === 'true' || value === 'yes' || value === 'on'
}

function registerGlobalMiddleware(app: OpenAPIHono): void {
  app.use(
    '*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PATCH', 'DELETE'],
      allowHeaders: [
        'Content-Type',
        'Accept',
        'Authorization',
        PRIVY_ID_TOKEN_HEADER,
        'MCP-Protocol-Version',
        'Mcp-Session-Id',
        'mcp-session-id',
        'Last-Event-ID',
        'X-PAYMENT',
        'PAYMENT-SIGNATURE',
        'payment-signature',
      ],
      exposeHeaders: [
        'Mcp-Session-Id',
        'mcp-session-id',
        'MCP-Protocol-Version',
        'X-PAYMENT-RESPONSE',
        'payment-required',
      ],
    })
  )
}

function registerHttpRoutes(app: OpenAPIHono): void {
  app.route('/', healthRoutes)
  app.route('/', authRoutes)
  app.route('/', userRoutes)
  app.route('/', vaultRoutes)
  app.route('/', tokenRoutes)
  app.route('/', agentRoutes)
  app.route('/', tradingRoutes)
  app.route('/', transactionRoutes)
  registerDiscoveryRoutes(app)
}

export function createApp(): OpenAPIHono {
  const app = new OpenAPIHono()

  registerGlobalMiddleware(app)
  registerHttpRoutes(app)

  app.get('/docs/swagger.json', (c) =>
    c.json(openApiJsonResponse(app, c.req.url), 200, {
      'Cache-Control': 'public, max-age=300',
    })
  )

  app.get(
    '/docs',
    (c, next) => {
      if (!isSwaggerEnabled(c.env as WorkerEnv)) {
        return c.text('Swagger is disabled', 404)
      }
      return next()
    },
    swaggerUI({ url: '/docs/swagger.json' })
  )

  app.notFound((c) =>
    c.json({ error: 'Not found', path: new URL(c.req.url).pathname }, 404)
  )

  return app
}
