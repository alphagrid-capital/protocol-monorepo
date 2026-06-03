import type { Address, Hex } from 'viem'
import { loadAgentRegistrationConfig } from '../lib/agent-registration-config.js'
import type { AgentRegistrationConfig } from '../lib/agent-registration-config.js'
import {
  AGENT_REGISTRY_EIP712_DOMAIN,
  verifySelfRegisterSignature,
} from '../lib/eip712-agent-registration.js'
import type { SelfRegisterTypedData } from '../lib/eip712-agent-registration.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import { AppError } from '../errors.js'
import { ProviderService } from './provider.service.js'
import {
  AgentNotFoundError,
  AgentRegistryService,
} from './agent-registry.service.js'
import type { AgentRecord } from '../schemas/agent.js'
import { RegistrationFeeService } from './fee-manager.service.js'
import type {
  AgentRegistrationQuote,
  AgentRegistrationRequest,
  AgentRegistrationResponse,
} from '../schemas/agent.js'

export type GetAgentResult = {
  mode: 'mock' | 'live'
  agentId: string
  agent: AgentRecord
  agentRegistry: `0x${string}` | null
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
    const feeState = await new RegistrationFeeService(this.config).getDetails()
    const feeAtomic = feeState.amount

    let signerNonce: string | null = null
    let domainName: string = AGENT_REGISTRY_EIP712_DOMAIN.name
    let domainVersion: string = AGENT_REGISTRY_EIP712_DOMAIN.version

    if (
      signer &&
      this.config.mode === 'live' &&
      this.config.agentRegistry &&
      this.config.rpcUrl
    ) {
      const nonce = await this.agentRegistryService().getSignerNonce(signer)
      signerNonce = nonce.toString()
    } else if (signer && this.config.mode === 'mock') {
      signerNonce = '0'
    }

    if (
      this.config.mode === 'live' &&
      this.config.agentRegistry &&
      this.config.rpcUrl
    ) {
      const domain = await this.agentRegistryService().getEip712Domain()
      domainName = domain.name
      domainVersion = domain.version
    }

    return {
      mode: this.config.mode,
      registrationFee: {
        amount: feeAtomic.toString(),
        assetSymbol: 'USDC',
        decimals: 6,
        displayUsd: feeState.displayUsd,
      },
      x402: {
        enabled: feeAtomic > 0n,
        network: feeAtomic > 0n ? this.config.x402.network : null,
        payTo: feeState.treasury,
        facilitatorUrl: feeAtomic > 0n ? this.config.x402.facilitatorUrl : null,
        httpRoute: 'POST /agents/register',
      },
      eip712: {
        domainName,
        domainVersion,
        chainId: this.config.chainId,
        verifyingContract: this.config.agentRegistry,
        primaryType: 'SelfRegister',
        selfRegisterTypehash:
          '0x943fcd588cbf2f97757c6f41f78f5a7f133ad3f3111e330a636c80c3e3c70679',
      },
      agentRegistry: this.config.agentRegistry,
      signerNonce,
    }
  }

  async register(
    body: AgentRegistrationRequest
  ): Promise<AgentRegistrationResponse> {
    const parsed = this.parseRequest(body)

    if (
      this.config.mode === 'live' &&
      this.config.agentRegistry &&
      this.config.rpcUrl
    ) {
      parsed.nonce = await this.agentRegistryService().getSignerNonce(
        parsed.signer
      )
    }

    if (this.config.mode === 'live' && this.config.agentRegistry) {
      if (!this.config.rpcUrl) {
        throw new AgentRegistrationError(
          'RPC_URL is not configured; required to read AgentRegistry EIP-712 domain',
          503
        )
      }

      const domain = await this.agentRegistryService().getEip712Domain()
      const valid = await verifySelfRegisterSignature({
        domainName: domain.name,
        domainVersion: domain.version,
        chainId: this.config.chainId,
        verifyingContract: this.config.agentRegistry,
        data: parsed,
        signature: parsed.signature,
      })
      if (!valid) {
        throw new AgentRegistrationError(
          'Invalid SelfRegister EIP-712 signature',
          400
        )
      }
    }

    if (this.config.mode === 'mock') {
      return {
        mode: 'mock',
        agentId: '1',
        transactionHash: null,
        transaction: null,
        message:
          'Mock registration accepted (signature check skipped). Configure AGENT_REGISTRY_ADDRESS and RPC_URL for live registration.',
      }
    }

    if (!this.config.agentRegistry) {
      throw new AgentRegistrationError(
        'AGENT_REGISTRY_ADDRESS is not configured',
        503
      )
    }

    const feeState = await new RegistrationFeeService(this.config).getDetails()
    const feeAtomic = feeState.amount
    if (feeAtomic > 0n && (!this.config.feeManager || !this.config.rpcUrl)) {
      throw new AgentRegistrationError(
        'FEE_MANAGER_ADDRESS and RPC_URL must be configured when registration fee is non-zero',
        503
      )
    }

    if (this.config.relayerPrivateKey) {
      const { agentId, transactionHash } =
        await this.submitRelayerRegistration(parsed)
      return {
        mode: 'live',
        agentId,
        transactionHash,
        transaction: null,
        message:
          feeAtomic > 0n
            ? 'Agent registered on-chain by registrar relayer after x402 fee settlement.'
            : 'Agent registered on-chain by registrar relayer (zero registration fee).',
      }
    }

    if (feeAtomic > 0n) {
      throw new AgentRegistrationError(
        'RELAYER_PRIVATE_KEY is not configured; cannot submit registration after x402 payment',
        503
      )
    }

    return {
      mode: 'live',
      agentId: null,
      transactionHash: null,
      transaction: null,
      message:
        'Configure RELAYER_PRIVATE_KEY for on-chain registrar registration.',
    }
  }

  async getAgent(agentId: string): Promise<GetAgentResult> {
    if (this.config.mode !== 'live' || !this.config.agentRegistry) {
      throw new AgentRegistrationError(
        'Agent lookup requires a deployed AgentRegistry and RPC_URL',
        503
      )
    }

    try {
      const agent = await this.agentRegistryService().getAgent(BigInt(agentId))
      return {
        mode: 'live',
        agentId,
        agent,
        agentRegistry: this.config.agentRegistry,
      }
    } catch (error) {
      if (error instanceof AgentNotFoundError) {
        throw new AgentRegistrationError(error.message, 404)
      }
      throw error
    }
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
    if (!this.config.rpcUrl) {
      throw new AgentRegistrationError('RPC_URL is not configured', 503)
    }
    return ProviderService.fromConfig(this.config)
  }

  private agentRegistryService(): AgentRegistryService {
    if (!this.config.agentRegistry) {
      throw new AgentRegistrationError(
        'AGENT_REGISTRY_ADDRESS is not configured',
        503
      )
    }
    return new AgentRegistryService(
      this.providerService(),
      this.config.agentRegistry
    )
  }

  private async submitRelayerRegistration(
    parsed: SelfRegisterTypedData & { signature: Hex }
  ): Promise<{ agentId: string; transactionHash: Hex }> {
    if (!this.config.agentRegistry || !this.config.relayerPrivateKey) {
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
