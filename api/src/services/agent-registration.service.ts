import type { Address, Hex } from 'viem'
import { loadAgentRegistrationConfig } from '../lib/agent-registration-config.js'
import type { AgentRegistrationConfig } from '../lib/agent-registration-config.js'
import {
  AGENT_REGISTRY_EIP712_DOMAIN,
  verifySelfRegisterSignature,
} from '../lib/eip712-agent-registration.js'
import type { SelfRegisterTypedData } from '../lib/eip712-agent-registration.js'
import { HTTP_ROUTES } from '../constants/routes.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import { AppError } from '../errors.js'
import { isContractRevert } from '../lib/viem-revert.js'
import { ProviderService } from './provider.service.js'
import {
  AgentNotFoundError,
  AgentRegistryService,
  Erc8004NotRegisteredError,
} from './agent-registry.service.js'
import { FeeManagerService } from './fee-manager.service.js'
import type {
  AgentRecord,
  AgentRegistrationQuote,
  AgentRegistrationRequest,
  AgentRegistrationResponse,
  LinkErc8004Request,
  LinkErc8004Response,
  ListAgentsByOwnerResponse,
} from '../schemas/agent.js'

export interface GetAgentResult {
  agentId: string
  agent: AgentRecord
  agentRegistry: `0x${string}`
}

export class AgentRegistrationError extends AppError {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message, status)
    this.name = 'AgentRegistrationError'
  }
}

export class AgentRegistrationService {
  constructor(private readonly config: AgentRegistrationConfig) {}

  static fromEnv(
    env: Record<string, string | undefined> = getWorkerEnv()
  ): AgentRegistrationService {
    return new AgentRegistrationService(loadAgentRegistrationConfig(env))
  }

  async getQuote(signer?: Address): Promise<AgentRegistrationQuote> {
    const feeState = await new FeeManagerService(
      this.config
    ).getRegistrationFee()
    const feeAtomic = feeState.amount

    let signerNonce: string | null = null
    let domainName: string = AGENT_REGISTRY_EIP712_DOMAIN.name
    let domainVersion: string = AGENT_REGISTRY_EIP712_DOMAIN.version

    if (signer) {
      const nonce = await this.agentRegistryService().getSignerNonce(signer)
      signerNonce = nonce.toString()
    }

    const domain = await this.agentRegistryService().getEip712Domain()
    domainName = domain.name
    domainVersion = domain.version

    return {
      registrationFee: {
        amount: feeAtomic.toString(),
        assetSymbol: this.config.registrationFee.assetSymbol,
        tokenAddress: feeState.feeAsset,
        decimals: this.config.registrationFee.decimals,
        displayUsd: feeState.displayUsd,
      },
      x402: {
        enabled: feeAtomic > 0n,
        network: feeAtomic > 0n ? this.config.x402.network : null,
        payTo: feeState.treasury,
        facilitatorUrl: feeAtomic > 0n ? this.config.x402.facilitatorUrl : null,
        httpRoute: HTTP_ROUTES.agentRegister,
      },
      eip712: {
        domainName,
        domainVersion,
        chainId: this.config.chainId,
        verifyingContract: this.config.agentRegistryAddress,
        primaryType: 'SelfRegister',
        selfRegisterTypehash:
          '0x943fcd588cbf2f97757c6f41f78f5a7f133ad3f3111e330a636c80c3e3c70679',
      },
      agentRegistry: this.config.agentRegistryAddress,
      signerNonce,
    }
  }

  async register(
    body: AgentRegistrationRequest
  ): Promise<AgentRegistrationResponse> {
    const parsed = this.parseRequest(body)

    parsed.nonce = await this.agentRegistryService().getSignerNonce(
      parsed.signer
    )

    const domain = await this.agentRegistryService().getEip712Domain()
    const valid = await verifySelfRegisterSignature({
      domainName: domain.name,
      domainVersion: domain.version,
      chainId: this.config.chainId,
      verifyingContract: this.config.agentRegistryAddress,
      data: parsed,
      signature: parsed.signature,
    })
    if (!valid) {
      throw new AgentRegistrationError(
        'Invalid SelfRegister EIP-712 signature',
        400
      )
    }

    if (!this.config.relayerPrivateKey) {
      throw new AgentRegistrationError(
        'RELAYER_PRIVATE_KEY is not configured',
        503
      )
    }

    const feeState = await new FeeManagerService(
      this.config
    ).getRegistrationFee()
    const feeAtomic = feeState.amount

    const { agentId, transactionHash } =
      await this.submitRelayerRegistration(parsed)
    return {
      agentId,
      transactionHash,
      transaction: null,
      message:
        feeAtomic > 0n
          ? 'Agent registered on-chain by registrar relayer after x402 fee settlement.'
          : 'Agent registered on-chain by registrar relayer (zero registration fee).',
    }
  }

  async getAgent(agentId: string): Promise<GetAgentResult> {
    try {
      const agent = await this.agentRegistryService().getAgent(BigInt(agentId))
      return {
        agentId,
        agent,
        agentRegistry: this.config.agentRegistryAddress,
      }
    } catch (error) {
      if (error instanceof AgentNotFoundError) {
        throw new AgentRegistrationError(error.message, 404)
      }
      throw error
    }
  }

  async getAgentByErc8004(erc8004AgentId: string): Promise<GetAgentResult> {
    try {
      const result = await this.agentRegistryService().getAgentByErc8004(
        BigInt(erc8004AgentId)
      )
      return {
        agentId: result.agentId,
        agent: result.agent,
        agentRegistry: this.config.agentRegistryAddress,
      }
    } catch (error) {
      if (error instanceof Erc8004NotRegisteredError) {
        throw new AgentRegistrationError(error.message, 404)
      }
      throw error
    }
  }

  async listAgentsByOwner(owner: Address): Promise<ListAgentsByOwnerResponse> {
    const agents = await this.agentRegistryService().listAgentsByOwner(owner)
    return {
      owner,
      agentRegistry: this.config.agentRegistryAddress,
      count: agents.length,
      agents,
    }
  }

  async linkErc8004(
    agentId: string,
    body: LinkErc8004Request
  ): Promise<LinkErc8004Response> {
    if (!this.config.relayerPrivateKey) {
      throw new AgentRegistrationError(
        'RELAYER_PRIVATE_KEY is not configured',
        503
      )
    }

    try {
      const { transactionHash, agent } =
        await this.agentRegistryService().linkErc8004WithRelayer(
          this.config.relayerPrivateKey,
          BigInt(agentId),
          BigInt(body.erc8004AgentId)
        )
      return {
        agentId,
        agent,
        agentRegistry: this.config.agentRegistryAddress,
        transactionHash,
      }
    } catch (error) {
      throw this.mapLinkErc8004Error(error)
    }
  }

  private mapLinkErc8004Error(error: unknown): AgentRegistrationError {
    if (error instanceof AgentNotFoundError) {
      return new AgentRegistrationError(error.message, 404)
    }
    if (error instanceof AgentRegistrationError) {
      return error
    }

    const revertMessages: Record<string, string> = {
      ERC8004AlreadyLinked: 'Agent already has an ERC-8004 identity linked',
      NotERC8004Owner: 'Agent owner does not hold the ERC-8004 identity NFT',
      NotAgentOwner: 'Caller is not authorized to link ERC-8004 for this agent',
      ZeroAddress: 'Invalid zero address in link request',
    }
    for (const [name, message] of Object.entries(revertMessages)) {
      if (isContractRevert(error, name)) {
        return new AgentRegistrationError(message, 400)
      }
    }

    if (isContractRevert(error, 'EnforcedPause')) {
      return new AgentRegistrationError('AgentRegistry is paused', 503)
    }

    const message =
      error instanceof Error ? error.message : 'On-chain ERC-8004 link failed'
    if (message.includes('reverted')) {
      return new AgentRegistrationError(message, 502)
    }
    return new AgentRegistrationError(message, 503)
  }

  private parseRequest(
    body: AgentRegistrationRequest
  ): SelfRegisterTypedData & { signature: Hex } {
    const deadline = BigInt(body.deadline)
    const now = BigInt(Math.floor(Date.now() / 1000))
    if (deadline < now) {
      throw new AgentRegistrationError('Registration deadline has expired', 400)
    }

    return {
      vault: body.vault as Address,
      name: body.name,
      metadataURI: body.metadataURI,
      signer: body.signer as Address,
      linkERC8004: body.linkERC8004,
      erc8004AgentId: BigInt(body.erc8004AgentId),
      nonce: 0n,
      deadline,
      signature: body.signature as Hex,
    }
  }

  private providerService(): ProviderService {
    return ProviderService.fromConfig(this.config)
  }

  private agentRegistryService(): AgentRegistryService {
    return new AgentRegistryService(
      this.providerService(),
      this.config.agentRegistryAddress
    )
  }

  private async submitRelayerRegistration(
    parsed: SelfRegisterTypedData & { signature: Hex }
  ): Promise<{ agentId: string; transactionHash: Hex }> {
    if (!this.config.relayerPrivateKey) {
      throw new AgentRegistrationError('Relayer is not configured', 503)
    }
    try {
      return await this.agentRegistryService().registerWithRelayer(
        this.config.relayerPrivateKey,
        parsed
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'On-chain registration failed'
      if (message.includes('reverted') || message.includes('AgentRegistered')) {
        throw new AgentRegistrationError(message, 502)
      }
      throw new AgentRegistrationError(message, 503)
    }
  }
}

export async function getAgentRegistrationQuote(
  signer?: Address,
  env: Record<string, string | undefined> = getWorkerEnv()
): Promise<AgentRegistrationQuote> {
  return AgentRegistrationService.fromEnv(env).getQuote(signer)
}

export async function registerAgent(
  body: AgentRegistrationRequest,
  env: Record<string, string | undefined> = getWorkerEnv()
): Promise<AgentRegistrationResponse> {
  return AgentRegistrationService.fromEnv(env).register(body)
}
