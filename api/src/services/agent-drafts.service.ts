import { contracts } from '../constants/contracts.js'
import { AppError } from '../errors.js'
import {
  AgentDraftsRepository,
} from '../db/agent-drafts.repository.js'
import type { AgentDraftRow, UpdateAgentDraftInput  } from '../db/agent-drafts.repository.js'
import { AgentProfilesRepository } from '../db/agent-profiles.repository.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import { normalizeAddress } from '../lib/evm/utils.js'
import type {
  AgentDraft,
  AgentIdentity,
  AgentWallet,
  BotFrequency,
  UpdateAgentDraftSchema,
} from '../schemas/agent-draft.js'
import type { z } from 'zod'
import type { WorkerEnv } from '../types/worker-env.js'

type UpdateAgentDraftBody = z.infer<typeof UpdateAgentDraftSchema>

function parseIdentityJson(value: string | null): AgentIdentity | undefined {
  if (!value) {
    return undefined
  }
  return JSON.parse(value) as AgentIdentity
}

function parseWalletJson(value: string | null): AgentWallet | undefined {
  if (!value) {
    return undefined
  }
  return JSON.parse(value) as AgentWallet
}

function parseBotFrequency(value: string | null): BotFrequency | null {
  if (value === '1h' || value === '1d') {
    return value
  }
  return null
}

function toAgentDraft(row: AgentDraftRow): AgentDraft {
  const identity = parseIdentityJson(row.identity_json)
  const wallet = parseWalletJson(row.wallet_json) ?? null
  return {
    draftId: row.id,
    owner: row.owner_address,
    identity,
    wallet,
    strategy: row.strategy,
    botFrequency: parseBotFrequency(row.bot_frequency),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function newDraftId(): string {
  return `draft_${crypto.randomUUID()}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function requireGenesisVault(chainId: number): `0x${string}` {
  const vault = contracts[chainId]?.GenesisVault
  if (!vault) {
    throw new AppError(
      `GenesisVault is not deployed for CHAIN_ID ${chainId}`,
      503,
      'SERVICE_UNAVAILABLE'
    )
  }
  return vault
}

export class AgentDraftsService {
  constructor(
    private readonly repository: AgentDraftsRepository,
    private readonly profilesRepository: AgentProfilesRepository,
    private readonly env: WorkerEnv
  ) {}

  static fromEnv(env: WorkerEnv = getWorkerEnv()): AgentDraftsService {
    return new AgentDraftsService(
      new AgentDraftsRepository(env),
      new AgentProfilesRepository(env),
      env
    )
  }

  private async isHandleTaken(
    handle: string,
    excludeDraftId?: string
  ): Promise<boolean> {
    if (await this.repository.isHandleTaken(handle, excludeDraftId)) {
      return true
    }
    return this.profilesRepository.isHandleTaken(handle)
  }

  async createDraft(
    ownerAddress: string,
    identity: AgentIdentity
  ): Promise<AgentDraft> {
    if (await this.isHandleTaken(identity.handle)) {
      throw new AppError('Handle is already taken', 400, 'INVALID_REQUEST')
    }

    const createdAt = nowIso()
    const row = await this.repository.create({
      id: newDraftId(),
      ownerAddress,
      handle: identity.handle,
      identityJson: JSON.stringify(identity),
      createdAt,
    })
    return toAgentDraft(row)
  }

  async getDraft(draftId: string, ownerAddress: string): Promise<AgentDraft> {
    const row = await this.requireOwnedDraft(draftId, ownerAddress)
    return toAgentDraft(row)
  }

  async listDrafts(ownerAddress: string): Promise<AgentDraft[]> {
    const rows = await this.repository.findByOwner(ownerAddress)
    return rows.map(toAgentDraft)
  }

  async updateDraft(
    draftId: string,
    ownerAddress: string,
    body: UpdateAgentDraftBody
  ): Promise<AgentDraft> {
    await this.requireEditableDraft(draftId, ownerAddress)
    const updatedAt = nowIso()
    const patch: UpdateAgentDraftInput = { updatedAt }

    if (body.identity !== undefined) {
      if (await this.isHandleTaken(body.identity.handle, draftId)) {
        throw new AppError('Handle is already taken', 400, 'INVALID_REQUEST')
      }
      patch.identityJson = JSON.stringify(body.identity)
      patch.handle = body.identity.handle
    }
    if (body.strategy !== undefined) {
      patch.strategy = body.strategy
    }
    if (body.botFrequency !== undefined) {
      patch.botFrequency = body.botFrequency
    }

    const row = await this.repository.update(draftId, patch)
    return toAgentDraft(row)
  }

  async abandonDraft(draftId: string, ownerAddress: string): Promise<void> {
    await this.requireOwnedDraft(draftId, ownerAddress)
    await this.repository.abandon(draftId, nowIso())
  }

  async requireEditableDraft(
    draftId: string,
    ownerAddress: string
  ): Promise<AgentDraftRow> {
    const row = await this.requireOwnedDraft(draftId, ownerAddress)
    if (row.status !== 'draft') {
      throw new AppError('Agent draft is not editable', 400, 'INVALID_REQUEST')
    }
    return row
  }

  async requireOwnedDraft(
    draftId: string,
    ownerAddress: string
  ): Promise<AgentDraftRow> {
    const row = await this.repository.findById(draftId)
    if (!row) {
      throw new AppError('Agent draft not found', 404, 'INVALID_REQUEST')
    }
    if (normalizeAddress(row.owner_address) !== normalizeAddress(ownerAddress)) {
      throw new AppError('Agent draft not found', 404, 'INVALID_REQUEST')
    }
    return row
  }

  getGenesisVaultAddress(): `0x${string}` {
    const chainId = Number(this.env.CHAIN_ID)
    if (!Number.isFinite(chainId)) {
      throw new AppError('CHAIN_ID is not configured', 503, 'SERVICE_UNAVAILABLE')
    }
    return requireGenesisVault(chainId)
  }
}
