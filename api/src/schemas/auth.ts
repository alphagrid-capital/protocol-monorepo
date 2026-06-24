import { z } from '@hono/zod-openapi'
import { addressSchema } from './evm.js'
import { UserProfileSummarySchema } from './user.js'

export const SessionResponseSchema = z
  .object({
    address: addressSchema,
    valid: z.literal(true),
    profile: UserProfileSummarySchema,
  })
  .openapi('SessionResponse')

export const AuthErrorSchema = z
  .object({
    error: z.string(),
  })
  .openapi('AuthError')

export const LogoutResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .openapi('LogoutResponse')
