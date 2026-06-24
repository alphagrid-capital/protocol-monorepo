import type { Address, Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { MAX_AGENTS_PER_USER } from '../constants/agent-limits.js'
import { AgentDraftsRepository  } from '../db/agent-drafts.repository.js'
import type {AgentDraftRow} from '../db/agent-drafts.repository.js';
import { AgentProfilesRepository } from '../db/agent-profiles.repository.js'
import { AgentSignersRepository } from '../db/agent-signers.repository.js'
import { AppError } from '../errors.js'
import { SELF_REGISTER_TYPES } from '../lib/eip712/agent-registration.js'
import { loadAgentRegistrationConfig } from '../lib/agent/registration-config.js'
import { buildAgentMetadataUri } from '../lib/agent/launch-metadata.js'
import { normalizeAddress } from '../lib/evm/utils.js'
import { computeNextRunAt } from '../lib/strategy/schedule.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import type { AgentIdentity, AgentWallet, BotFrequency } from '../schemas/agent-draft.js'
import { AgentDraftsService } from './agent-drafts.service.js'
import { AgentDraftWalletService } from './agent-draft-wallet.service.js'
import { AgentRegistryService } from './agent-registry.service.js'
import { FeeManagerService } from './fee-manager.service.js'
import { ProviderService } from './provider.service.js'
import type { WorkerEnv } from '../types/worker-env.js'

const REGISTRATION_DEADLINE_SECONDS = 3600

function pricingTierFromRegistrationFee(amount: bigint): 'free' | 'paid' {
  return amount === 0n ? 'free' : 'paid'
}

export interface LaunchAgentResult {
  agentId: string
  txHash: Hex
  status: 'pending'
  redirectUrl: string
}

export class AgentLaunchService {
  constructor(
    private readonly draftsService: AgentDraftsService,
    private readonly walletService: AgentDraftWalletService,
    private readonly draftsRepository: AgentDraftsRepository,
    private readonly signersRepository: AgentSignersRepository,
    private readonly profilesRepository: AgentProfilesRepository,
    private readonly env: WorkerEnv
  ) {}

  static fromEnv(env: WorkerEnv = getWorkerEnv()): AgentLaunchService {
    return new AgentLaunchService(
      AgentDraftsService.fromEnv(env),
      AgentDraftWalletService.fromEnv(env),
      new AgentDraftsRepository(env),
      new AgentSignersRepository(env),
      new AgentProfilesRepository(env),
      env
    )
  }

  async launchDraft(
    draftId: string,
    ownerAddress: string
  ): Promise<LaunchAgentResult> {
    const row = await this.draftsService.requireEditableDraft(
      draftId,
      ownerAddress
    )
    this.assertLaunchReady(row)

    const activeAgents = await this.profilesRepository.countActiveByOwner(
      ownerAddress
    )
    if (activeAgents >= MAX_AGENTS_PER_USER) {
      throw new AppError(
        `Maximum of ${MAX_AGENTS_PER_USER} active agents per user`,
        400,
        'INVALID_REQUEST'
      )
    }

    const identity = JSON.parse(row.identity_json!) as AgentIdentity
    const wallet = JSON.parse(row.wallet_json!) as AgentWallet
    const metadataURI = buildAgentMetadataUri(identity)

    const owner = normalizeAddress(ownerAddress) as Address
    const { privateKey, signerAddress } =
      await this.walletService.decryptSignerFromRow(row)

    const config = loadAgentRegistrationConfig(this.env)
    const registry = new AgentRegistryService(
      ProviderService.fromConfig(config),
      config.agentRegistryAddress
    )
    const [nonce, domain] = await Promise.all([
      registry.getSignerNonce(signerAddress),
      registry.getEip712Domain(),
    ])
    const deadline = BigInt(
      Math.floor(Date.now() / 1000) + REGISTRATION_DEADLINE_SECONDS
    )

    const typedData = {
      vault: wallet.vault as Address,
      name: identity.name,
      metadataURI,
      signer: signerAddress,
      linkERC8004: false,
      erc8004AgentId: 0n,
      nonce,
      deadline,
    }
    const signature = await privateKeyToAccount(privateKey).signTypedData({
      domain: {
        name: domain.name,
        version: domain.version,
        chainId: config.chainId,
        verifyingContract: config.agentRegistryAddress,
      },
      types: SELF_REGISTER_TYPES,
      primaryType: 'SelfRegister',
      message: typedData,
    })

    if (!config.relayerPrivateKey) {
      throw new AppError('RELAYER_PRIVATE_KEY is not configured', 503)
    }

    const launchedAt = new Date().toISOString()
    await this.draftsRepository.update(draftId, {
      status: 'launching',
      updatedAt: launchedAt,
    })

    let registered: { agentId: string; transactionHash: Hex } | null = null
    try {
      registered = await registry.registerWithRelayer(
        config.relayerPrivateKey,
        owner,
        { ...typedData, signature }
      )

      const encryptedKey = row.encrypted_signer_key!
      const { amount: registrationFee } = await new FeeManagerService(
        config
      ).getRegistrationFee()
      const pricingTier = pricingTierFromRegistrationFee(registrationFee)

      await this.draftsRepository.update(draftId, {
        status: 'launched',
        launchedAgentId: registered.agentId,
        launchTxHash: registered.transactionHash,
        encryptedSignerKey: null,
        pricingTier,
        updatedAt: launchedAt,
      })

      try {
        await this.signersRepository.create({
          agentId: registered.agentId,
          ownerAddress: owner,
          signerAddress,
          encryptedSignerKey: encryptedKey,
          keyVersion: row.key_version,
          createdAt: launchedAt,
        })
        await this.profilesRepository.create({
          agentId: registered.agentId,
          ownerAddress: owner,
          handle: identity.handle,
          strategy: row.strategy!,
          botFrequency: row.bot_frequency as BotFrequency,
          pricingTier,
          nextRunAt: computeNextRunAt(row.bot_frequency as BotFrequency),
          createdAt: launchedAt,
        })
      } catch {
        throw new AppError(
          'Agent registered on-chain but post-launch persistence failed',
          502,
          'UPSTREAM_FAILURE'
        )
      }

      return {
        agentId: registered.agentId,
        txHash: registered.transactionHash,
        status: 'pending',
        redirectUrl: `/app/agents/ag_${registered.agentId}`,
      }
    } catch (error) {
      if (!registered) {
        await this.draftsRepository.update(draftId, {
          status: 'draft',
          updatedAt: new Date().toISOString(),
        })
      }
      if (error instanceof AppError) {
        throw error
      }
      const message =
        error instanceof Error ? error.message : 'On-chain registration failed'
      throw new AppError(message, 502, 'UPSTREAM_FAILURE')
    }
  }

  private assertLaunchReady(row: AgentDraftRow): void {
    if (
      !row.identity_json ||
      !row.wallet_json ||
      !row.encrypted_signer_key ||
      !row.strategy ||
      !row.bot_frequency
    ) {
      throw new AppError('Draft is incomplete', 400, 'INVALID_REQUEST')
    }
    if (row.bot_frequency !== '1h' && row.bot_frequency !== '1d') {
      throw new AppError(
        'Bot frequency must be 1h or 1d',
        400,
        'INVALID_REQUEST'
      )
    }
  }
}
