import { z } from '@hono/zod-openapi'

const truthSocialUsernameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .transform((value) => value.replace(/^@+/, ''))
  .refine((value) => /^[A-Za-z0-9._]+$/.test(value), {
    message:
      'Truth Social username must be letters, digits, dots, or underscores',
  })

export const TruthSocialConnectionSchema = z
  .object({
    enabled: z.boolean(),
    username: truthSocialUsernameSchema,
  })
  .strict()

const equityNewsSymbolSchema = z
  .string()
  .trim()
  .min(1)
  .max(16)
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z0-9][A-Z0-9.\-]*$/.test(value), {
    message: 'Equity news symbol must be letters, digits, dots, or hyphens',
  })

/**
 * Equity / company news via Apify.
 * When `symbols` is omitted or empty, the strategy runner fills from the
 * vault `allowedSymbols` quote at run time.
 */
export const EquityNewsConnectionSchema = z
  .object({
    enabled: z.boolean(),
    symbols: z.array(equityNewsSymbolSchema).max(20).optional(),
  })
  .strict()

/** Per-agent external data provider configs. Unknown keys are rejected. */
export const DataConnectionsSchema = z
  .object({
    truthsocial: TruthSocialConnectionSchema.optional(),
    equitynews: EquityNewsConnectionSchema.optional(),
  })
  .strict()
  .openapi('DataConnections')

export type DataConnections = z.infer<typeof DataConnectionsSchema>
export type TruthSocialConnection = z.infer<typeof TruthSocialConnectionSchema>
export type EquityNewsConnection = z.infer<typeof EquityNewsConnectionSchema>

export function parseDataConnections(
  value: string | null | undefined
): DataConnections {
  if (!value) {
    return {}
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return {}
  }
  const result = DataConnectionsSchema.safeParse(parsed)
  return result.success ? result.data : {}
}

export function serializeDataConnections(
  connections: DataConnections
): string | null {
  if (Object.keys(connections).length === 0) {
    return null
  }
  return JSON.stringify(connections)
}
