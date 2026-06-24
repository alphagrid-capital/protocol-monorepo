import { AppError } from '../errors.js'
import { requireDb } from '../lib/db/db.js'
import { normalizeAddress } from '../lib/evm/utils.js'
import type { BotFrequency } from '../schemas/agent-draft.js'
import type { WorkerEnv } from '../types/worker-env.js'

export interface AgentProfileRow {
  agent_id: string
  owner_address: string
  handle: string
  strategy: string
  bot_frequency: string
  pricing_tier: string
  next_run_at: string
  archived_at: string | null
  created_at: string
}

export interface CreateAgentProfileInput {
  agentId: string
  ownerAddress: string
  handle: string
  strategy: string
  botFrequency: BotFrequency
  pricingTier: string
  nextRunAt: string
  createdAt: string
}

export interface UpdateAgentProfileInput {
  strategy?: string
  botFrequency?: BotFrequency
  nextRunAt?: string
}

export class AgentProfilesRepository {
  constructor(private readonly env: WorkerEnv) {}

  async create(input: CreateAgentProfileInput): Promise<AgentProfileRow> {
    const db = requireDb(this.env)
    const row = await db
      .prepare(
        `INSERT INTO agent_profiles (
           agent_id, owner_address, handle, strategy, bot_frequency,
           pricing_tier, next_run_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING *`
      )
      .bind(
        input.agentId,
        normalizeAddress(input.ownerAddress),
        input.handle,
        input.strategy,
        input.botFrequency,
        input.pricingTier,
        input.nextRunAt,
        input.createdAt
      )
      .first<AgentProfileRow>()

    if (!row) {
      throw new AppError('Failed to store agent profile', 503, 'SERVICE_UNAVAILABLE')
    }
    return row
  }

  async findByAgentId(agentId: string): Promise<AgentProfileRow | null> {
    const db = requireDb(this.env)
    return db
      .prepare('SELECT * FROM agent_profiles WHERE agent_id = ?')
      .bind(agentId)
      .first<AgentProfileRow>()
  }

  async findByOwner(ownerAddress: string): Promise<AgentProfileRow[]> {
    const db = requireDb(this.env)
    const result = await db
      .prepare(
        `SELECT * FROM agent_profiles
         WHERE owner_address = ?
         ORDER BY created_at DESC`
      )
      .bind(normalizeAddress(ownerAddress))
      .all<AgentProfileRow>()

    return result.results ?? []
  }

  async countActiveByOwner(ownerAddress: string): Promise<number> {
    const db = requireDb(this.env)
    const row = await db
      .prepare(
        `SELECT COUNT(*) AS count FROM agent_profiles
         WHERE owner_address = ? AND archived_at IS NULL`
      )
      .bind(normalizeAddress(ownerAddress))
      .first<{ count: number }>()

    return row?.count ?? 0
  }

  async isHandleTaken(handle: string): Promise<boolean> {
    const db = requireDb(this.env)
    const row = await db
      .prepare(
        `SELECT 1 FROM agent_profiles
         WHERE handle = ? AND archived_at IS NULL
         LIMIT 1`
      )
      .bind(handle)
      .first()
    return row !== null
  }

  async listDue(nowIso: string, limit: number): Promise<AgentProfileRow[]> {
    const db = requireDb(this.env)
    const result = await db
      .prepare(
        `SELECT * FROM agent_profiles
         WHERE archived_at IS NULL AND next_run_at <= ?
         ORDER BY next_run_at ASC
         LIMIT ?`
      )
      .bind(nowIso, limit)
      .all<AgentProfileRow>()

    return result.results ?? []
  }

  async bumpNextRunAt(agentId: string, nextRunAt: string): Promise<void> {
    const db = requireDb(this.env)
    await db
      .prepare('UPDATE agent_profiles SET next_run_at = ? WHERE agent_id = ?')
      .bind(nextRunAt, agentId)
      .run()
  }

  async archive(agentId: string, archivedAt: string): Promise<AgentProfileRow | null> {
    const db = requireDb(this.env)
    const row = await db
      .prepare(
        `UPDATE agent_profiles
         SET archived_at = ?
         WHERE agent_id = ? AND archived_at IS NULL
         RETURNING *`
      )
      .bind(archivedAt, agentId)
      .first<AgentProfileRow>()

    return row ?? null
  }

  async update(
    agentId: string,
    input: UpdateAgentProfileInput
  ): Promise<AgentProfileRow | null> {
    const db = requireDb(this.env)
    const sets: string[] = []
    const values: string[] = []

    if (input.strategy !== undefined) {
      sets.push('strategy = ?')
      values.push(input.strategy)
    }
    if (input.botFrequency !== undefined) {
      sets.push('bot_frequency = ?')
      values.push(input.botFrequency)
    }
    if (input.nextRunAt !== undefined) {
      sets.push('next_run_at = ?')
      values.push(input.nextRunAt)
    }

    if (sets.length === 0) {
      return this.findByAgentId(agentId)
    }

    const row = await db
      .prepare(
        `UPDATE agent_profiles
         SET ${sets.join(', ')}
         WHERE agent_id = ? AND archived_at IS NULL
         RETURNING *`
      )
      .bind(...values, agentId)
      .first<AgentProfileRow>()

    return row ?? null
  }
}
