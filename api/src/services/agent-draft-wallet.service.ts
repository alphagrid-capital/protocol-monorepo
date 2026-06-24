import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import type { Address, Hex } from 'viem'
import { AgentDraftsRepository } from '../db/agent-drafts.repository.js'
import { AppError } from '../errors.js'
import {
  decryptSignerPrivateKey,
  encryptSignerPrivateKey,
  requireSignerEncryptionKey,
} from '../lib/crypto/signer-key-crypto.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import { normalizeAddress } from '../lib/evm/utils.js'
import type { AgentWallet } from '../schemas/agent-draft.js'
import { AgentDraftsService } from './agent-drafts.service.js'
import type { WorkerEnv } from '../types/worker-env.js'

function nowIso(): string {
  return new Date().toISOString()
}

function requireEncryptionKey(env: WorkerEnv): string {
  try {
    return requireSignerEncryptionKey(env)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'AGENT_SIGNER_ENCRYPTION_KEY is not configured'
    throw new AppError(message, 503, 'SERVICE_UNAVAILABLE')
  }
}

export class AgentDraftWalletService {
  constructor(
    private readonly draftsService: AgentDraftsService,
    private readonly repository: AgentDraftsRepository,
    private readonly env: WorkerEnv
  ) {}

  static fromEnv(env: WorkerEnv = getWorkerEnv()): AgentDraftWalletService {
    const draftsService = AgentDraftsService.fromEnv(env)
    return new AgentDraftWalletService(
      draftsService,
      new AgentDraftsRepository(env),
      env
    )
  }

  async provisionWallet(
    draftId: string,
    ownerAddress: string
  ): Promise<AgentWallet> {
    const row = await this.draftsService.requireEditableDraft(
      draftId,
      ownerAddress
    )
    if (!row.identity_json) {
      throw new AppError('Draft identity is required', 400, 'INVALID_REQUEST')
    }

    const vault = this.draftsService.getGenesisVaultAddress()
    const payoutRecipient = normalizeAddress(ownerAddress) as Address

    if (row.signer_address && row.wallet_json) {
      return JSON.parse(row.wallet_json) as AgentWallet
    }

    const privateKey = generatePrivateKey()
    const account = privateKeyToAccount(privateKey)
    const encryptionKey = requireEncryptionKey(this.env)
    const encryptedSignerKey = await encryptSignerPrivateKey(
      privateKey,
      encryptionKey
    )

    const wallet: AgentWallet = {
      signer: account.address,
      vault,
      payoutRecipient,
    }

    await this.repository.update(draftId, {
      walletJson: JSON.stringify(wallet),
      signerAddress: account.address,
      encryptedSignerKey,
      updatedAt: nowIso(),
    })

    return wallet
  }

  async decryptDraftSignerKey(
    draftId: string,
    ownerAddress: string
  ): Promise<{ privateKey: Hex; signerAddress: Address }> {
    const row = await this.draftsService.requireOwnedDraft(draftId, ownerAddress)
    return this.decryptSignerFromRow(row)
  }

  async decryptSignerFromRow(
    row: { encrypted_signer_key: string | null; signer_address: string | null }
  ): Promise<{ privateKey: Hex; signerAddress: Address }> {
    if (!row.encrypted_signer_key || !row.signer_address) {
      throw new AppError('Agent signer is not provisioned', 400, 'INVALID_REQUEST')
    }
    const privateKey = await decryptSignerPrivateKey(
      row.encrypted_signer_key,
      requireEncryptionKey(this.env)
    )
    return {
      privateKey,
      signerAddress: normalizeAddress(row.signer_address) as Address,
    }
  }
}
