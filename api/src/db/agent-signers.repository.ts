import { AppError } from '../errors.js'
import { requireDb } from '../lib/db/db.js'
import { normalizeAddress } from '../lib/evm/utils.js'
import type { WorkerEnv } from '../types/worker-env.js'

export interface AgentSignerRow {
  agent_id: string
  owner_address: string
  signer_address: string
  encrypted_signer_key: string
  key_version: number
  created_at: string
}

export interface CreateAgentSignerInput {
  agentId: string
  ownerAddress: string
  signerAddress: string
  encryptedSignerKey: string
  keyVersion?: number
  createdAt: string
}

export class AgentSignersRepository {
  constructor(private readonly env: WorkerEnv) {}

  async create(input: CreateAgentSignerInput): Promise<AgentSignerRow> {
    const db = requireDb(this.env)
    const row = await db
      .prepare(
        `INSERT INTO agent_signers (
           agent_id, owner_address, signer_address, encrypted_signer_key,
           key_version, created_at
         ) VALUES (?, ?, ?, ?, ?, ?)
         RETURNING *`
      )
      .bind(
        input.agentId,
        normalizeAddress(input.ownerAddress),
        normalizeAddress(input.signerAddress),
        input.encryptedSignerKey,
        input.keyVersion ?? 1,
        input.createdAt
      )
      .first<AgentSignerRow>()

    if (!row) {
      throw new AppError(
        'Failed to store agent signer',
        503,
        'SERVICE_UNAVAILABLE'
      )
    }
    return row
  }

  async findByAgentId(agentId: string): Promise<AgentSignerRow | null> {
    const db = requireDb(this.env)
    return db
      .prepare('SELECT * FROM agent_signers WHERE agent_id = ?')
      .bind(agentId)
      .first<AgentSignerRow>()
  }

  async syncOwnerAddress(agentId: string, ownerAddress: string): Promise<void> {
    const db = requireDb(this.env)
    await db
      .prepare('UPDATE agent_signers SET owner_address = ? WHERE agent_id = ?')
      .bind(normalizeAddress(ownerAddress), agentId)
      .run()
  }

  async wipeEncryptedKey(agentId: string): Promise<void> {
    const db = requireDb(this.env)
    await db
      .prepare(
        'UPDATE agent_signers SET encrypted_signer_key = ? WHERE agent_id = ?'
      )
      .bind('', agentId)
      .run()
  }
}
