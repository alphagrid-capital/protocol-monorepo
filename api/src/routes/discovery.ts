import { createRoute, z } from '@hono/zod-openapi'
import type { OpenAPIHono } from '@hono/zod-openapi'
import { mcpDiscovery } from '../mcp/discovery.js'
import {
  buildDiscoveryFromOpenApi,
  buildLlmsTxtFromOpenApi,
} from '../lib/discovery/from-openapi.js'
import { ROUTE_PATHS } from '../constants/routes.js'
import { absoluteUrl } from '../lib/http/url-utils.js'
import { openApiJsonResponse } from '../openapi.js'

const DiscoverySchema = z
  .object({
    name: z.string(),
    version: z.string(),
    description: z.string(),
    baseUrl: z.url(),
    documentation: z.object({
      openapi: z.url(),
      swaggerUi: z.url(),
      llmsTxt: z.url(),
    }),
    operations: z.array(
      z.object({
        method: z.string(),
        path: z.string(),
        url: z.url(),
        summary: z.string(),
        description: z.string(),
        tags: z.array(z.string()),
        formats: z.array(z.string()),
      })
    ),
    fetchableEndpoints: z.array(
      z.object({
        method: z.string(),
        path: z.string(),
        url: z.url(),
        summary: z.string(),
        description: z.string(),
        tags: z.array(z.string()),
        formats: z.array(z.string()),
      })
    ),
    mcp: z.object({
      method: z.string(),
      url: z.url(),
      note: z.string(),
      tools: z.array(z.string()),
    }),
    hints: z.object({
      forChatGptBrowsing: z.string(),
      forCustomGptActions: z.string(),
      forMcpClients: z.string(),
    }),
  })
  .openapi('ApiDiscovery')

export const discoveryRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['System'],
  summary: 'API discovery',
  description:
    'Index derived from the auto-generated OpenAPI spec. See /docs/swagger.json for the full Swagger document.',
  responses: {
    200: {
      description: 'API index (generated from OpenAPI)',
      content: {
        'application/json': {
          schema: DiscoverySchema,
        },
      },
    },
  },
})

/**
 * Registers discovery routes on the root app after all other OpenAPI routes
 * are mounted so `getOpenAPI31Document` reflects the full surface.
 */
export function registerDiscoveryRoutes(app: OpenAPIHono) {
  app.openapi(discoveryRoute, (c) => {
    const spec = openApiJsonResponse(app, c.req.url)
    return c.json(
      buildDiscoveryFromOpenApi(spec, c.req.url, mcpDiscovery(c.req.url))
    )
  })

  app.get('/llms.txt', (c) => {
    const spec = openApiJsonResponse(app, c.req.url)
    const body = buildLlmsTxtFromOpenApi(
      spec,
      c.req.url,
      mcpDiscovery(c.req.url)
    )
    return c.text(body, 200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    })
  })

  app.get('/robots.txt', (c) => {
    const lines = [
      'User-agent: *',
      'Allow: /',
      'Allow: /vaults',
      'Allow: /tokens',
      'Allow: /prices',
      'Allow: /llms.txt',
      `Allow: ${ROUTE_PATHS.swaggerJson}`,
      '',
      `# LLM discovery: ${absoluteUrl(c.req.url, ROUTE_PATHS.llmsTxt)}`,
    ]
    return c.text(lines.join('\n'), 200, {
      'Content-Type': 'text/plain; charset=utf-8',
    })
  })
}
