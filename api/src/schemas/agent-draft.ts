import { z } from '@hono/zod-openapi'

const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Expected 0x-prefixed 20-byte address')

const handleSchema = z
  .string()
  .regex(
    /^[a-z0-9-]{1,20}$/,
    'Handle must be 1-20 chars: lowercase letters, digits, hyphens'
  )

/** Strategy runner tick interval. Only `1h` and `1d` are supported (`1m` / `1s` rejected). */
export const BotFrequencySchema = z.enum(['1h', '1d']).openapi({
  example: '1h',
  description:
    'Bot run frequency: `1h` (hourly) or `1d` (daily). Minute/second values are not supported.',
})

export const AgentIdentitySchema = z
  .object({
    name: z.string().min(1).max(128),
    handle: handleSchema,
    description: z.string().max(2048).default(''),
    links: z
      .object({
        x: z.url().optional(),
        github: z.url().optional(),
        website: z.url().optional(),
      })
      .default({}),
  })
  .strict()

export const AgentDraftSchema = z
  .object({
    draftId: z.string(),
    owner: addressSchema,
    identity: AgentIdentitySchema.optional(),
    vaultAddress: addressSchema,
    strategy: z.string().nullable(),
    botFrequency: BotFrequencySchema.nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('AgentDraft')

export const CreateAgentDraftSchema = z
  .object({
    identity: AgentIdentitySchema,
  })
  .strict()

export const UpdateAgentDraftSchema = CreateAgentDraftSchema.partial()
  .extend({
    strategy: z.string().min(1).max(8192).optional(),
    botFrequency: BotFrequencySchema.optional(),
  })
  .strict()
  .refine(
    (body) =>
      body.identity !== undefined ||
      body.strategy !== undefined ||
      body.botFrequency !== undefined,
    { message: 'At least one field must be provided' }
  )

export const ProvisionWalletResponseSchema = z
  .object({
    signerAddress: addressSchema,
  })
  .openapi('ProvisionWalletResponse')

export const LaunchAgentResponseSchema = z
  .object({
    agentId: z.string(),
    txHash: z.string().regex(/^0x[a-fA-F0-9]+$/),
    status: z.literal('pending'),
    redirectUrl: z.string(),
  })
  .openapi('LaunchAgentResponse')

export const AgentDraftListSchema = z
  .object({
    drafts: z.array(AgentDraftSchema),
    total: z.number().int().nonnegative(),
  })
  .openapi('AgentDraftList')

export const AgentDraftErrorSchema = z
  .object({
    error: z.string(),
  })
  .openapi('AgentDraftError')

export const draftIdParamSchema = z
  .string()
  .regex(/^draft_[0-9a-f-]{36}$/, 'Expected draft_<uuid>')

export type AgentIdentity = z.infer<typeof AgentIdentitySchema>
export type AgentDraft = z.infer<typeof AgentDraftSchema>
export type BotFrequency = z.infer<typeof BotFrequencySchema>
