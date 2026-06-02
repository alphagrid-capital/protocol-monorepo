import { z } from '@hono/zod-openapi'

export const VaultSummarySchema = z
  .object({
    id: z.string().openapi({ example: 'foundation' }),
    name: z.string().openapi({ example: 'Foundation' }),
    slug: z.string().openapi({ example: 'foundation' }),
    tagline: z.string().openapi({ example: 'Large-cap liquid equities' }),
    description: z.string(),
    tvlUsd: z.number().openapi({ example: 125_000 }),
    tvlChange24hPct: z.number().openapi({ example: 0.8 }),
    agentCount: z.number().int().openapi({ example: 12 }),
    returnYtdPct: z.number().openapi({ example: 8.2 }),
    chainId: z.number().int().openapi({ example: 4660 }),
    contractAddress: z
      .string()
      .openapi({ example: '0x000000000000000000000000000000000000f001' }),
  })
  .openapi('VaultSummary')

export const ListVaultsResponseSchema = z
  .object({
    vaults: z.array(VaultSummarySchema),
    total: z.number().int(),
  })
  .openapi('ListVaultsResponse')
