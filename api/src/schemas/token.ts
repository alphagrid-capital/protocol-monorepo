import { z } from '@hono/zod-openapi'

export const TokenPriceSchema = z
  .object({
    priceUsd: z.string().nullable().openapi({ example: '150.25' }),
    updatedAt: z.string().nullable().openapi({ example: '1717500000' }),
    stale: z.boolean().openapi({ example: false }),
  })
  .openapi('TokenPrice')

export const TokenSummarySchema = z
  .object({
    symbol: z.string().openapi({ example: 'NVDA' }),
    name: z.string().openapi({ example: 'NVIDIA' }),
    address: z
      .string()
      .nullable()
      .openapi({ example: '0x0000000000000000000000000000000000000000' }),
    decimals: z.number().int().openapi({ example: 18 }),
    vaultIds: z.array(z.string()).openapi({
      description: 'Vault slugs where MandateVault.isAllowedToken is true',
      example: ['genesis'],
    }),
    listed: z.boolean().openapi({ example: true }),
    active: z.boolean().openapi({ example: true }),
    allowedInVault: z.boolean().optional().openapi({ example: true }),
    price: TokenPriceSchema.optional(),
  })
  .openapi('TokenSummary')

export const ListTokensResponseSchema = z
  .object({
    chainId: z.number().int(),
    priceOracle: z.string().nullable(),
    tokens: z.array(TokenSummarySchema),
    total: z.number().int(),
  })
  .openapi('ListTokensResponse')

export const VaultTokensResponseSchema = z
  .object({
    vaultId: z.string(),
    chainId: z.number().int(),
    priceOracle: z.string().nullable(),
    tokens: z.array(TokenSummarySchema),
    total: z.number().int(),
  })
  .openapi('VaultTokensResponse')

export const TokenNotFoundSchema = z
  .object({
    error: z.string(),
  })
  .openapi('TokenNotFound')

export const OraclePriceEntrySchema = z
  .object({
    symbol: z.string().openapi({ example: 'NVDA' }),
    address: z
      .string()
      .nullable()
      .openapi({ example: '0x0000000000000000000000000000000000000000' }),
    priceUsd: z.string().nullable().openapi({ example: '150.25' }),
    updatedAt: z.string().nullable().openapi({ example: '1717500000' }),
    quoted: z.boolean().openapi({
      description: 'True when MockPriceOracle has a price for this token',
    }),
  })
  .openapi('OraclePriceEntry')

export const OraclePricesResponseSchema = z
  .object({
    chainId: z.number().int().openapi({ example: 84532 }),
    priceOracle: z.string().nullable(),
    prices: z.record(z.string(), OraclePriceEntrySchema).openapi({
      description: 'Catalog symbols keyed to current on-chain oracle quotes',
    }),
  })
  .openapi('OraclePricesResponse')

export const RefreshOraclePricesResponseSchema = z
  .object({
    updated: z.number().int().openapi({ example: 8 }),
    skipped: z.boolean().openapi({ example: false }),
    reason: z
      .string()
      .optional()
      .openapi({ example: 'FINNHUB_API_KEY not set' }),
    transactionHash: z.string().optional().openapi({ example: '0xabc...' }),
  })
  .openapi('RefreshOraclePricesResponse')

export const RefreshOraclePricesErrorSchema = z
  .object({
    error: z.string(),
    updated: z.number().int().optional(),
    skipped: z.boolean().optional(),
    reason: z.string().optional(),
  })
  .openapi('RefreshOraclePricesError')
