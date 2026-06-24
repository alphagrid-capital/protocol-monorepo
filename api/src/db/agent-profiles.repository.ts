import { AppError } from '../errors.js'
import { requireDb } from '../lib/db.js'
import { normalizeAddress } from '../lib/evm-uilts.js'
import type { BotFrequency } from '../schemas/agent-draft.js'
import type { WorkerEnv } from '../types/worker-env.js'

export interface AgentProfileRow {
  agent_id: string
  owner_address: string
  handle: string
  strategy: string
  bot_frequency: string
  pricing_tier: string
  created_at: string
}

export interface CreateAgentProfileInput {
  agentId: string
  ownerAddress: string
  handle: string
  strategy: string
  botFrequency: BotFrequency
  pricingTier: string
  createdAt: string
}

export class AgentProfilesRepository {
  constructor(private readonly env: WorkerEnv) {}

  async create(input: CreateAgentProfileInput): Promise<AgentProfileRow> {
    const db = requireDb(this.env)
    const row = await db
      .prepare(
        `INSERT INTO agent_profiles (
           agent_id, owner_address, handle, strategy, bot_frequency, pricing_tier, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)
         RETURNING *`
      )
      .bind(
        input.agentId,
        normalizeAddress(input.ownerAddress),
        input.handle,
        input.strategy,
        input.botFrequency,
        input.pricingTier,
        input.createdAt
      )
      .first<AgentProfileRow>()

    if (!row) {
      throw new AppError('Failed to store agent profile', 503, 'SERVICE_UNAVAILABLE')
    }
    return row
  }
}
