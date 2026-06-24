import { AppError } from '../errors.js'
import { requireDb } from '../lib/db/db.js'
import { normalizeAddress } from '../lib/evm/utils.js'
import type { WorkerEnv } from '../types/worker-env.js'

export type AgentDraftStatus = 'draft' | 'launching' | 'launched' | 'abandoned'

export interface AgentDraftRow {
  id: string
  owner_address: string
  handle: string | null
  identity_json: string | null
  wallet_json: string | null
  strategy: string | null
  bot_frequency: string | null
  pricing_tier: string | null
  signer_address: string | null
  encrypted_signer_key: string | null
  key_version: number
  status: AgentDraftStatus
  launched_agent_id: string | null
  launch_tx_hash: string | null
  created_at: string
  updated_at: string
}

export interface CreateAgentDraftInput {
  id: string
  ownerAddress: string
  handle: string
  identityJson: string
  createdAt: string
}

export interface UpdateAgentDraftInput {
  handle?: string | null
  identityJson?: string | null
  walletJson?: string | null
  strategy?: string | null
  botFrequency?: string | null
  pricingTier?: string | null
  signerAddress?: string | null
  encryptedSignerKey?: string | null
  status?: AgentDraftStatus
  launchedAgentId?: string | null
  launchTxHash?: string | null
  updatedAt: string
}

const DRAFT_COLUMNS = `id, owner_address, handle, identity_json, wallet_json,
  strategy, bot_frequency, pricing_tier, signer_address, encrypted_signer_key,
  key_version, status, launched_agent_id, launch_tx_hash, created_at, updated_at`

export class AgentDraftsRepository {
  constructor(private readonly env: WorkerEnv) {}

  async findById(id: string): Promise<AgentDraftRow | null> {
    const db = requireDb(this.env)
    return db
      .prepare(`SELECT ${DRAFT_COLUMNS} FROM agent_drafts WHERE id = ?`)
      .bind(id)
      .first<AgentDraftRow>()
  }

  async findByOwner(ownerAddress: string): Promise<AgentDraftRow[]> {
    const db = requireDb(this.env)
    const result = await db
      .prepare(
        `SELECT ${DRAFT_COLUMNS} FROM agent_drafts
         WHERE owner_address = ? AND status = 'draft'
         ORDER BY updated_at DESC`
      )
      .bind(normalizeAddress(ownerAddress))
      .all<AgentDraftRow>()
    return result.results ?? []
  }

  async isHandleTaken(handle: string, excludeDraftId?: string): Promise<boolean> {
    const db = requireDb(this.env)
    const query = excludeDraftId
      ? `SELECT 1 FROM agent_drafts WHERE handle = ? AND status = 'draft' AND id != ? LIMIT 1`
      : `SELECT 1 FROM agent_drafts WHERE handle = ? AND status = 'draft' LIMIT 1`
    const row = excludeDraftId
      ? await db.prepare(query).bind(handle, excludeDraftId).first()
      : await db.prepare(query).bind(handle).first()
    return row !== null
  }

  async create(input: CreateAgentDraftInput): Promise<AgentDraftRow> {
    const db = requireDb(this.env)
    const owner = normalizeAddress(input.ownerAddress)
    const row = await db
      .prepare(
        `INSERT INTO agent_drafts (
           id, owner_address, handle, identity_json, status,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, 'draft', ?, ?)
         RETURNING ${DRAFT_COLUMNS}`
      )
      .bind(
        input.id,
        owner,
        input.handle,
        input.identityJson,
        input.createdAt,
        input.createdAt
      )
      .first<AgentDraftRow>()

    if (!row) {
      throw new AppError('Failed to create agent draft', 503, 'SERVICE_UNAVAILABLE')
    }
    return row
  }

  async update(id: string, input: UpdateAgentDraftInput): Promise<AgentDraftRow> {
    const db = requireDb(this.env)
    const sets: string[] = ['updated_at = ?']
    const values: unknown[] = [input.updatedAt]

    if (input.handle !== undefined) {
      sets.push('handle = ?')
      values.push(input.handle)
    }
    if (input.identityJson !== undefined) {
      sets.push('identity_json = ?')
      values.push(input.identityJson)
    }
    if (input.walletJson !== undefined) {
      sets.push('wallet_json = ?')
      values.push(input.walletJson)
    }
    if (input.strategy !== undefined) {
      sets.push('strategy = ?')
      values.push(input.strategy)
    }
    if (input.botFrequency !== undefined) {
      sets.push('bot_frequency = ?')
      values.push(input.botFrequency)
    }
    if (input.pricingTier !== undefined) {
      sets.push('pricing_tier = ?')
      values.push(input.pricingTier)
    }
    if (input.signerAddress !== undefined) {
      sets.push('signer_address = ?')
      values.push(input.signerAddress)
    }
    if (input.encryptedSignerKey !== undefined) {
      sets.push('encrypted_signer_key = ?')
      values.push(input.encryptedSignerKey)
    }
    if (input.status !== undefined) {
      sets.push('status = ?')
      values.push(input.status)
    }
    if (input.launchedAgentId !== undefined) {
      sets.push('launched_agent_id = ?')
      values.push(input.launchedAgentId)
    }
    if (input.launchTxHash !== undefined) {
      sets.push('launch_tx_hash = ?')
      values.push(input.launchTxHash)
    }

    values.push(id)
    const row = await db
      .prepare(
        `UPDATE agent_drafts SET ${sets.join(', ')} WHERE id = ?
         RETURNING ${DRAFT_COLUMNS}`
      )
      .bind(...values)
      .first<AgentDraftRow>()

    if (!row) {
      throw new AppError('Agent draft not found', 404, 'INVALID_REQUEST')
    }
    return row
  }

  async abandon(id: string, updatedAt: string): Promise<void> {
    const db = requireDb(this.env)
    const result = await db
      .prepare(
        `UPDATE agent_drafts SET
           status = 'abandoned',
           encrypted_signer_key = NULL,
           signer_address = NULL,
           updated_at = ?
         WHERE id = ?`
      )
      .bind(updatedAt, id)
      .run()
    if (result.meta.changes === 0) {
      throw new AppError('Agent draft not found', 404, 'INVALID_REQUEST')
    }
  }

  async abandonStale(cutoffIso: string, updatedAt: string): Promise<number> {
    const db = requireDb(this.env)
    const result = await db
      .prepare(
        `UPDATE agent_drafts SET
           status = 'abandoned',
           encrypted_signer_key = NULL,
           signer_address = NULL,
           updated_at = ?
         WHERE status = 'draft' AND updated_at < ?`
      )
      .bind(updatedAt, cutoffIso)
      .run()
    return result.meta.changes ?? 0
  }
}
