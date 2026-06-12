import { z } from '@hono/zod-openapi'

export const txHashParamSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/)
  .openapi({ example: '0x' + '0'.repeat(64) })

export const TransactionStatusResponseSchema = z
  .object({
    transactionHash: txHashParamSchema,
    status: z.enum(['pending', 'success', 'reverted']),
    blockNumber: z.string().optional(),
    blockTimestamp: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  })
  .openapi('TransactionStatusResponse')

export type TransactionStatusResponse = z.infer<
  typeof TransactionStatusResponseSchema
>
