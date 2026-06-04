import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  GetVaultResponseSchema,
  ListVaultsResponseSchema,
  VaultNotFoundSchema,
} from '../schemas/vault.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import { VaultsService } from '../services/vaults.service.js'

const listVaultsRoute = createRoute({
  method: 'get',
  path: '/vaults',
  tags: ['Vaults'],
  summary: 'List vaults',
  description:
    'Returns thematic ERC-4626 vaults registered in VaultTrackRegistry with per-track policy from getVaultTrackConfig. Use `?format=md` or `Accept: text/markdown` for LLM-friendly plain text.',
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

const getVaultRoute = createRoute({
  method: 'get',
  path: '/vaults/{id}',
  tags: ['Vaults'],
  summary: 'Get vault by id',
  description:
    'Returns a single thematic vault by `id`, `slug`, or contract address from VaultTrackRegistry.',
  request: {
    params: z.object({
      id: z.string().min(1).openapi({
        param: { name: 'id', in: 'path' },
        example: 'foundation',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Vault details',
      content: {
        'application/json': {
          schema: GetVaultResponseSchema,
        },
      },
    },
    404: {
      description: 'Vault not found',
      content: {
        'application/json': {
          schema: VaultNotFoundSchema,
        },
      },
    },
  },
})

export const vaultRoutes = new OpenAPIHono()

vaultRoutes.openapi(getVaultRoute, async (c) => {
  const vault = await VaultsService.fromEnv(getWorkerEnv()).getVaultById(
    c.req.param('id')
  )
  if (!vault) {
    return c.json({ error: 'Vault not found' }, 404)
  }
  return c.json({ vault }, 200, {
    'Cache-Control': 'public, max-age=60',
  })
})

vaultRoutes.openapi(listVaultsRoute, async (c) => {
  const service = VaultsService.fromEnv(getWorkerEnv())
  const data = await service.listVaults()
  const format = c.req.query('format')
  const accept = c.req.header('accept') ?? ''

  if (format === 'md' || accept.includes('text/markdown')) {
    return c.text(service.formatVaultsMarkdown(data), 200, {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    })
  }

  return c.json(data, 200, {
    'Cache-Control': 'public, max-age=60',
  })
})
