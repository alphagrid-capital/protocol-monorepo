import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { HealthResponseSchema } from '../schemas/health.js'

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: 'Health check',
  description: 'Returns service liveness for load balancers and monitors.',
  responses: {
    200: {
      description: 'Service is healthy',
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
    },
  },
})

export const healthRoutes = new OpenAPIHono()

healthRoutes.openapi(healthRoute, (c) =>
  c.json({ status: 'ok' as const, service: 'alphagrid-api' })
)
