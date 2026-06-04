import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  ListTokensResponseSchema,
  OraclePricesResponseSchema,
  RefreshOraclePricesErrorSchema,
  RefreshOraclePricesResponseSchema,
  VaultTokensResponseSchema,
} from '../schemas/token.js'
import { VaultNotFoundSchema } from '../schemas/vault.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import { isOracleRefreshAuthorized } from '../lib/oracle-refresh-auth.js'
import { updateMockPrices } from '../jobs/update-mock-prices.js'
import { TokensService } from '../services/tokens.service.js'

const listTokensRoute = createRoute({
  method: 'get',
  path: '/tokens',
  tags: ['Tokens'],
  summary: 'List tradable tokens',
  description:
    'Returns the protocol token catalog merged with on-chain TokenRegistry and MockPriceOracle quotes when deployed.',
  responses: {
    200: {
      description: 'Token catalog',
      content: {
        'application/json': {
          schema: ListTokensResponseSchema,
        },
      },
    },
  },
})

const vaultTokensRoute = createRoute({
  method: 'get',
  path: '/vaults/{id}/tokens',
  tags: ['Tokens', 'Vaults'],
  summary: 'List tokens allowed for a vault',
  description:
    'Returns catalog tokens for the vault mandate intersected with on-chain allowlist (`isAllowedToken`) and live oracle prices.',
  request: {
    params: z.object({
      id: z
        .string()
        .min(1)
        .openapi({
          param: { name: 'id', in: 'path' },
          example: 'tech',
        }),
    }),
  },
  responses: {
    200: {
      description: 'Vault token list',
      content: {
        'application/json': {
          schema: VaultTokensResponseSchema,
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

const oraclePricesRoute = createRoute({
  method: 'get',
  path: '/prices',
  tags: ['Tokens'],
  summary: 'Oracle prices by symbol',
  description:
    'Returns current MockPriceOracle quotes for catalog symbols, keyed by ticker (e.g. NVDA).',
  responses: {
    200: {
      description: 'On-chain oracle prices indexed by symbol',
      content: {
        'application/json': {
          schema: OraclePricesResponseSchema,
        },
      },
    },
  },
})

const refreshOraclePricesRoute = createRoute({
  method: 'post',
  path: '/prices/refresh',
  tags: ['Tokens'],
  summary: 'Refresh oracle prices from Finnhub',
  description:
    'Fetches latest quotes for catalog symbols and submits MockPriceOracle.setPrices on-chain. Same logic as the scheduled keeper. Optional `Authorization: Bearer <ORACLE_REFRESH_SECRET>` when that env var is set.',
  responses: {
    200: {
      description: 'Prices updated on-chain',
      content: {
        'application/json': {
          schema: RefreshOraclePricesResponseSchema,
        },
      },
    },
    401: {
      description: 'Missing or invalid refresh secret',
      content: {
        'application/json': {
          schema: RefreshOraclePricesErrorSchema,
        },
      },
    },
    503: {
      description: 'Refresh skipped (misconfiguration or no quotes)',
      content: {
        'application/json': {
          schema: RefreshOraclePricesErrorSchema,
        },
      },
    },
  },
})

export const tokenRoutes = new OpenAPIHono()

tokenRoutes.openapi(listTokensRoute, async (c) => {
  const data = await TokensService.fromEnv(getWorkerEnv()).listTokens()
  return c.json(data, 200, {
    'Cache-Control': 'public, max-age=60',
  })
})

tokenRoutes.openapi(oraclePricesRoute, async (c) => {
  const data = await TokensService.fromEnv(getWorkerEnv()).getOraclePrices()
  return c.json(data, 200, {
    'Cache-Control': 'public, max-age=60',
  })
})

tokenRoutes.openapi(refreshOraclePricesRoute, async (c) => {
  const env = getWorkerEnv()
  if (!isOracleRefreshAuthorized(env, c.req.header('Authorization'))) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const result = await updateMockPrices(env)
  if (result.skipped) {
    return c.json(
      {
        error: 'Oracle price refresh skipped',
        updated: result.updated,
        skipped: result.skipped,
        reason: result.reason,
      },
      503
    )
  }

  return c.json(result, 200)
})

tokenRoutes.openapi(vaultTokensRoute, async (c) => {
  const result = await TokensService.fromEnv(getWorkerEnv()).listVaultTokens(
    c.req.param('id')
  )
  if (!result) {
    return c.json({ error: 'Vault not found' }, 404)
  }
  return c.json(result, 200, {
    'Cache-Control': 'public, max-age=60',
  })
})
