import type { Address } from 'viem'
import { MAX_AGENTS_PER_USER } from '../constants/agent-limits.js'
import {
  AgentProfilesRepository,
  type AgentProfileRow,
} from '../db/agent-profiles.repository.js'
import { AgentSignersRepository } from '../db/agent-signers.repository.js'
import { AppError } from '../errors.js'
import { normalizeAddress } from '../lib/evm/utils.js'
import { computeNextRunAt } from '../lib/strategy/schedule.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import type { BotFrequency } from '../schemas/agent-draft.js'
import type {
  GetAgentResponse,
  ListAgentsByOwnerResponse,
  ManagedAgentStatus,
} from '../schemas/agent.js'
import type { WorkerEnv } from '../types/worker-env.js'
import {
  AgentRegistrationError,
  AgentRegistrationService,
} from './agent-registration.service.js'

export interface ManagedAgentProfile {
  agentId: string
  handle: string
  strategy: string
  botFrequency: BotFrequency
  pricingTier: string
  nextRunAt: string
  archivedAt: string | null
  createdAt: string
}

export interface ManagedAgentList {
  agents: ManagedAgentProfile[]
  total: number
  activeCount: number
  maxAgents: number
}

function toManagedStatus(profile: AgentProfileRow | null): ManagedAgentStatus {
  if (!profile) {
    return { isManaged: false, archivedAt: null }
  }
  return { isManaged: true, archivedAt: profile.archived_at }
}

function toManagedProfile(row: AgentProfileRow): ManagedAgentProfile {
  const botFrequency = row.bot_frequency
  if (botFrequency !== '1h' && botFrequency !== '1d') {
    throw new AppError('Invalid bot frequency in agent profile', 503)
  }

  return {
    agentId: row.agent_id,
    handle: row.handle,
    strategy: row.strategy,
    botFrequency,
    pricingTier: row.pricing_tier,
    nextRunAt: row.next_run_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  }
}

export class ManagedAgentService {
  constructor(
    private readonly env: WorkerEnv,
    private readonly profilesRepository: AgentProfilesRepository,
    private readonly signersRepository: AgentSignersRepository,
    private readonly registrationService: AgentRegistrationService
  ) {}

  static fromEnv(env: WorkerEnv = getWorkerEnv()): ManagedAgentService {
    return new ManagedAgentService(
      env,
      new AgentProfilesRepository(env),
      new AgentSignersRepository(env),
      AgentRegistrationService.fromEnv(env)
    )
  }

  async getAgent(agentId: string): Promise<GetAgentResponse> {
    const base = await this.registrationService.getAgent(agentId)
    const profile = await this.profilesRepository.findByAgentId(agentId)
    const reconciled = await this.reconcileOwnerIfNeeded(
      agentId,
      base.agent.owner,
      profile
    )
    return {
      ...base,
      managed: toManagedStatus(reconciled),
    }
  }

  async getAgentByErc8004(erc8004AgentId: string): Promise<GetAgentResponse> {
    const base =
      await this.registrationService.getAgentByErc8004(erc8004AgentId)
    const profile = await this.profilesRepository.findByAgentId(base.agentId)
    const reconciled = await this.reconcileOwnerIfNeeded(
      base.agentId,
      base.agent.owner,
      profile
    )
    return {
      ...base,
      managed: toManagedStatus(reconciled),
    }
  }

  async listAgentsByOwner(owner: Address): Promise<ListAgentsByOwnerResponse> {
    const base = await this.registrationService.listAgentsByOwner(owner)
    const profiles = await this.profilesRepository.findByAgentIds(
      base.agents.map((agent) => agent.agentId)
    )

    const agents = await Promise.all(
      base.agents.map(async ({ agentId, agent }) => {
        const profile = profiles.get(agentId) ?? null
        const reconciled = await this.reconcileOwnerIfNeeded(
          agentId,
          agent.owner,
          profile
        )
        return {
          agentId,
          agent,
          managed: toManagedStatus(reconciled),
        }
      })
    )

    return {
      ...base,
      agents,
    }
  }

  async listManagedForOwner(owner: Address): Promise<ManagedAgentList> {
    const onChain = await this.registrationService.listAgentsByOwner(owner)
    const profiles = await this.profilesRepository.findByAgentIds(
      onChain.agents.map((agent) => agent.agentId)
    )

    const agents: ManagedAgentProfile[] = []
    for (const { agentId, agent } of onChain.agents) {
      const profile = profiles.get(agentId)
      if (!profile) {
        continue
      }
      const reconciled = await this.reconcileOwnerIfNeeded(
        agentId,
        agent.owner,
        profile
      )
      if (!reconciled) {
        continue
      }
      agents.push(toManagedProfile(reconciled))
    }

    const activeCount = agents.filter(
      (agent) => agent.archivedAt === null
    ).length
    return {
      agents,
      total: agents.length,
      activeCount,
      maxAgents: MAX_AGENTS_PER_USER,
    }
  }

  async countActiveManagedForOwner(owner: Address): Promise<number> {
    const list = await this.listManagedForOwner(owner)
    return list.activeCount
  }

  async getManagedProfile(
    agentId: string,
    authAddress: string
  ): Promise<ManagedAgentProfile> {
    const access = await this.requireManagedOwner(agentId, authAddress)
    if ('error' in access) {
      throw access.error
    }
    return toManagedProfile(access.profile)
  }

  async updateManagedProfile(
    agentId: string,
    authAddress: string,
    input: { strategy?: string; botFrequency?: BotFrequency }
  ): Promise<ManagedAgentProfile> {
    const access = await this.requireManagedOwner(agentId, authAddress)
    if ('error' in access) {
      throw access.error
    }

    if (access.profile.archived_at !== null) {
      throw new AppError(
        'Archived agents cannot be updated',
        400,
        'INVALID_REQUEST'
      )
    }

    const updated = await this.profilesRepository.update(agentId, {
      strategy: input.strategy,
      botFrequency: input.botFrequency,
      nextRunAt:
        input.botFrequency !== undefined
          ? computeNextRunAt(input.botFrequency)
          : undefined,
    })

    if (!updated) {
      throw new AppError(
        'Managed agent profile not found',
        404,
        'INVALID_REQUEST'
      )
    }

    return toManagedProfile(updated)
  }

  async archiveManagedAgent(
    agentId: string,
    authAddress: string
  ): Promise<ManagedAgentProfile> {
    const access = await this.requireManagedOwner(agentId, authAddress)
    if ('error' in access) {
      throw access.error
    }

    if (access.profile.archived_at !== null) {
      throw new AppError('Agent is already archived', 400, 'INVALID_REQUEST')
    }

    const archivedAt = new Date().toISOString()
    const archived = await this.profilesRepository.archive(agentId, archivedAt)
    if (!archived) {
      throw new AppError('Failed to archive agent', 503, 'SERVICE_UNAVAILABLE')
    }

    await this.signersRepository.wipeEncryptedKey(agentId)
    return toManagedProfile(archived)
  }

  async requireManagedOwner(
    agentId: string,
    authAddress: string
  ): Promise<{ profile: AgentProfileRow } | { error: AppError }> {
    let onChainOwner: Address
    try {
      const onChain = await this.registrationService.getAgent(agentId)
      onChainOwner = onChain.agent.owner as Address
    } catch (error) {
      if (error instanceof AgentRegistrationError && error.status === 404) {
        return {
          error: new AppError('Agent not found', 404, 'INVALID_REQUEST'),
        }
      }
      throw error
    }

    if (normalizeAddress(onChainOwner) !== normalizeAddress(authAddress)) {
      return { error: new AppError('Forbidden', 403, 'INVALID_REQUEST') }
    }

    const profile = await this.profilesRepository.findByAgentId(agentId)
    if (!profile) {
      return {
        error: new AppError(
          'Managed agent profile not found',
          404,
          'INVALID_REQUEST'
        ),
      }
    }

    const reconciled = await this.reconcileOwnerIfNeeded(
      agentId,
      onChainOwner,
      profile
    )
    if (!reconciled) {
      return {
        error: new AppError(
          'Managed agent profile not found',
          404,
          'INVALID_REQUEST'
        ),
      }
    }

    return { profile: reconciled }
  }

  private async reconcileOwnerIfNeeded(
    agentId: string,
    onChainOwner: string,
    profile: AgentProfileRow | null
  ): Promise<AgentProfileRow | null> {
    if (!profile) {
      return null
    }

    const normalizedOwner = normalizeAddress(onChainOwner)
    if (normalizeAddress(profile.owner_address) === normalizedOwner) {
      return profile
    }

    const syncedProfile = await this.profilesRepository.syncOwnerAddress(
      agentId,
      normalizedOwner
    )
    if (syncedProfile) {
      await this.signersRepository.syncOwnerAddress(agentId, normalizedOwner)
    }
    return syncedProfile
  }
}
