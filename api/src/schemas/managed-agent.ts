import { z } from '@hono/zod-openapi'
import { agentIdParamSchema } from './agent.js'
import { BotFrequencySchema } from './agent-draft.js'

export const ManagedAgentProfileSchema = z
  .object({
    agentId: agentIdParamSchema,
    handle: z.string(),
    strategy: z.string(),
    botFrequency: BotFrequencySchema,
    pricingTier: z.string(),
    nextRunAt: z.string(),
    archivedAt: z.string().nullable(),
    createdAt: z.string(),
  })
  .openapi('ManagedAgentProfile')

export const UpdateManagedAgentSchema = z
  .object({
    strategy: z.string().min(1).max(8192).optional(),
    botFrequency: BotFrequencySchema.optional(),
  })
  .strict()
  .refine(
    (body) => body.strategy !== undefined || body.botFrequency !== undefined,
    { message: 'At least one field must be provided' }
  )

export const ManagedAgentResponseSchema = z
  .object({
    profile: ManagedAgentProfileSchema,
  })
  .openapi('ManagedAgentResponse')

export const ManagedAgentErrorSchema = z
  .object({
    error: z.string(),
  })
  .openapi('ManagedAgentError')

export const ManagedAgentListSchema = z
  .object({
    agents: z.array(ManagedAgentProfileSchema),
    total: z.number().int(),
    activeCount: z.number().int(),
    maxAgents: z.number().int(),
  })
  .openapi('ManagedAgentList')

export const ArchiveManagedAgentResponseSchema = z
  .object({
    profile: ManagedAgentProfileSchema,
  })
  .openapi('ArchiveManagedAgentResponse')

export type UpdateManagedAgent = z.infer<typeof UpdateManagedAgentSchema>
