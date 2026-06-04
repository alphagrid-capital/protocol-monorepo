import { z } from '@hono/zod-openapi'

export const VaultTrackConfigSchema = z
  .object({
    vault: z.string().openapi({ example: '0x98e47A7CF1Cc880aDA3CC51D39b136BDf0D962AA' }),
    trackId: z.number().int().openapi({ example: 0 }),
    initialAllocation: z.string().openapi({ example: '10000000000' }),
    maxAllocation: z.string().openapi({ example: '25000000000' }),
    maxDrawdownBps: z.number().int().openapi({ example: 1500 }),
    maxTradeSizeBps: z.number().int().openapi({ example: 5000 }),
    maxDailyTurnoverBps: z.number().int().openapi({ example: 2500 }),
    evaluationPeriod: z.string().openapi({ example: '1209600' }),
    minTrades: z.number().int().openapi({ example: 5 }),
    promotionScore: z.number().int().openapi({ example: 70 }),
    active: z.boolean().openapi({ example: true }),
  })
  .openapi('VaultTrackConfig')

export const VaultSummarySchema = z
  .object({
    id: z.string().openapi({ example: 'foundation' }),
    name: z.string().openapi({ example: 'Foundation' }),
    slug: z.string().openapi({ example: 'foundation' }),
    tagline: z.string().openapi({ example: 'Large-cap liquid equities' }),
    description: z.string(),
    vaultTrackConfigs: z.array(VaultTrackConfigSchema),
    chainId: z.number().int().openapi({ example: 84532 }),
    contractAddress: z
      .string()
      .openapi({ example: '0x98e47A7CF1Cc880aDA3CC51D39b136BDf0D962AA' }),
  })
  .openapi('VaultSummary')

export const ListVaultsResponseSchema = z
  .object({
    vaults: z.array(VaultSummarySchema),
    total: z.number().int(),
  })
  .openapi('ListVaultsResponse')

export const GetVaultResponseSchema = z
  .object({
    vault: VaultSummarySchema,
  })
  .openapi('GetVaultResponse')

export const VaultNotFoundSchema = z
  .object({
    error: z.string(),
  })
  .openapi('VaultNotFound')
