import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ListVaultsResponseSchema } from '../schemas/vault.js'
import { vaultsService } from '../services/vaults.service.js'

const listVaultsRoute = createRoute({
  method: 'get',
  path: '/vaults',
  tags: ['Vaults'],
  summary: 'List vaults',
  description:
    'Returns thematic ERC-4626 vaults with basic stats (TVL, agents, returns). Data is mocked until the indexer is connected. Use `?format=md` or `Accept: text/markdown` for LLM-friendly plain text.',
  request: {
    query: z.object({
      format: z
        .enum(['json', 'md'])
        .optional()
        .openapi({
          param: { name: 'format', in: 'query' },
          description: 'Response format: json (default) or md (markdown)',
          example: 'md',
        }),
    }),
  },
  responses: {
    200: {
      description: 'Vault catalog',
      content: {
        'application/json': {
          schema: ListVaultsResponseSchema,
        },
        'text/markdown': {
          schema: { type: 'string' },
        },
      },
    },
  },
})

export const vaultRoutes = new OpenAPIHono()

vaultRoutes.openapi(listVaultsRoute, (c) => {
  const data = vaultsService.listVaults()
  const format = c.req.query('format')
  const accept = c.req.header('accept') ?? ''

  if (format === 'md' || accept.includes('text/markdown')) {
    return c.text(vaultsService.formatVaultsMarkdown(data), 200, {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    })
  }

  return c.json(data, 200, {
    'Cache-Control': 'public, max-age=60',
  })
})
