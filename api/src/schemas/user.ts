import { z } from '@hono/zod-openapi'
import { PREFERRED_CURRENCIES } from '../constants/currencies.js'
import { addressSchema } from './evm.js'

export const PreferredCurrencySchema = z
  .enum(PREFERRED_CURRENCIES)
  .openapi('PreferredCurrency')

export const UserProfileSummarySchema = z
  .object({
    displayName: z.string().nullable(),
    email: z.string().email().nullable(),
    preferredCurrency: PreferredCurrencySchema,
    registeredAt: z.iso.datetime(),
    lastLoginAt: z.iso.datetime(),
  })
  .openapi('UserProfileSummary')

export const UserProfileSchema = UserProfileSummarySchema.extend({
  address: addressSchema,
  updatedAt: z.iso.datetime(),
}).openapi('UserProfile')

export const UpdateUserProfileSchema = z
  .object({
    displayName: z.string().min(1).max(64).nullable().optional(),
    preferredCurrency: PreferredCurrencySchema.optional(),
  })
  .refine(
    (value) =>
      value.displayName !== undefined || value.preferredCurrency !== undefined,
    { message: 'At least one of displayName or preferredCurrency is required' }
  )
  .openapi('UpdateUserProfile')

export const UserErrorSchema = z
  .object({
    error: z.string(),
  })
  .openapi('UserError')
