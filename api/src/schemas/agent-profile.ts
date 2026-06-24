import { z } from '@hono/zod-openapi'
import { MAX_AGENTS_PER_USER } from '../constants/agent-limits.js'
import { agentIdParamSchema } from './agent.js'
import { BotFrequencySchema } from './agent-draft.js'

export const AgentProfileSchema = z
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
  .openapi('AgentProfile')

export const UpdateAgentProfileSchema = z
  .object({
    strategy: z.string().min(1).max(8192).optional(),
    botFrequency: BotFrequencySchema.optional(),
  })
  .strict()
  .refine(
    (body) => body.strategy !== undefined || body.botFrequency !== undefined,
    { message: 'At least one field must be provided' }
  )

export const AgentProfileResponseSchema = z
  .object({
    profile: AgentProfileSchema,
  })
  .openapi('AgentProfileResponse')

export const AgentProfileErrorSchema = z
  .object({
    error: z.string(),
  })
  .openapi('AgentProfileError')

export const AgentProfileListSchema = z
  .object({
    agents: z.array(AgentProfileSchema),
    total: z.number().int(),
    activeCount: z.number().int(),
    maxAgents: z.number().int(),
  })
  .openapi('AgentProfileList')

export const ArchiveAgentResponseSchema = z
  .object({
    profile: AgentProfileSchema,
  })
  .openapi('ArchiveAgentResponse')

export type UpdateAgentProfile = z.infer<typeof UpdateAgentProfileSchema>
