import { decodeEventLog } from 'viem'
import type { Address, Hex } from 'viem'
import { isContractRevert } from '../lib/viem-revert.js'
import type { AgentRecord } from '../schemas/agent.js'
import { agentRegistryAbi } from './abis/agent-registry.js'
import type { ProviderService } from './provider.service.js'
import type { SelfRegisterTypedData } from '../lib/eip712-agent-registration.js'

export class AgentNotFoundError extends Error {
  constructor(readonly agentId: string) {
    super(`Agent not found: ${agentId}`)
    this.name = 'AgentNotFoundError'
  }
}

export class Erc8004NotRegisteredError extends Error {
  constructor(readonly erc8004AgentId: string) {
    super(`No agent linked to ERC-8004 identity: ${erc8004AgentId}`)
    this.name = 'Erc8004NotRegisteredError'
  }
}

export class AgentRegistryService {
  constructor(
    private readonly providerService: ProviderService,
    private readonly registryAddress: Address
  ) {}

  async getSignerNonce(signer: Address): Promise<bigint> {
    const client = this.providerService.createPublicClient()
    return client.readContract({
      address: this.registryAddress,
      abi: agentRegistryAbi,
      functionName: 'nonces',
      args: [signer],
    })
  }

  async getAgent(agentId: bigint): Promise<AgentRecord> {
    const client = this.providerService.createPublicClient()
    try {
      const agent = await client.readContract({
        address: this.registryAddress,
        abi: agentRegistryAbi,
        functionName: 'getAgent',
        args: [agentId],
      })
      return this.mapAgentRecord(agent)
    } catch (error) {
      if (isContractRevert(error, 'AgentNotFound')) {
        throw new AgentNotFoundError(agentId.toString())
      }
      throw error
    }
  }

  async listAgentsByOwner(
    owner: Address
  ): Promise<Array<{ agentId: string; agent: AgentRecord }>> {
    const client = this.providerService.createPublicClient()
    const count = await client.readContract({
      address: this.registryAddress,
      abi: agentRegistryAbi,
      functionName: 'agentCountByOwner',
      args: [owner],
    })

    if (count === 0n) {
      return []
    }

    const countNum = Number(count)
    const idResults = await client.multicall({
      contracts: Array.from({ length: countNum }, (_, index) => ({
        address: this.registryAddress,
        abi: agentRegistryAbi,
        functionName: 'agentIdByOwnerAt' as const,
        args: [owner, BigInt(index)] as const,
      })),
    })

    const agentIds = idResults.map((result) => {
      if (result.status === 'failure') {
        throw result.error
      }
      return result.result
    })

    const agentResults = await client.multicall({
      contracts: agentIds.map((agentId) => ({
        address: this.registryAddress,
        abi: agentRegistryAbi,
        functionName: 'getAgent' as const,
        args: [agentId] as const,
      })),
    })

    return agentIds.map((agentId, index) => {
      const result = agentResults[index]
      if (result.status === 'failure') {
        throw result.error
      }
      return {
        agentId: agentId.toString(),
        agent: this.mapAgentRecord(result.result),
      }
    })
  }

  async getAgentByErc8004(
    erc8004AgentId: bigint
  ): Promise<{ agentId: string; agent: AgentRecord }> {
    const client = this.providerService.createPublicClient()
    try {
      const agent = await client.readContract({
        address: this.registryAddress,
        abi: agentRegistryAbi,
        functionName: 'getAgentByERC8004',
        args: [erc8004AgentId],
      })
      const agentId = await client.readContract({
        address: this.registryAddress,
        abi: agentRegistryAbi,
        functionName: 'agentIdByERC8004',
        args: [erc8004AgentId],
      })
      return {
        agentId: agentId.toString(),
        agent: this.mapAgentRecord(agent),
      }
    } catch (error) {
      if (isContractRevert(error, 'ERC8004NotRegistered')) {
        throw new Erc8004NotRegisteredError(erc8004AgentId.toString())
      }
      throw error
    }
  }

  async linkErc8004WithRelayer(
    relayerPrivateKey: Hex,
    agentId: bigint,
    erc8004AgentId: bigint
  ): Promise<{ transactionHash: Hex; agent: AgentRecord }> {
    const publicClient = this.providerService.createPublicClient()
    const walletClient =
      this.providerService.createWalletClient(relayerPrivateKey)

    const transactionHash = await walletClient.writeContract({
      address: this.registryAddress,
      abi: agentRegistryAbi,
      functionName: 'linkERC8004Identity',
      args: [agentId, erc8004AgentId],
    })

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: transactionHash,
    })
    if (receipt.status !== 'success') {
      throw new Error('On-chain ERC-8004 link transaction reverted')
    }

    const agent = await this.getAgent(agentId)
    return { transactionHash, agent }
  }

  private mapAgentRecord(agent: {
    owner: Address
    signer: Address
    payoutRecipient: Address
    vault: Address
    track: number
    status: number
    name: string
    metadataURI: string
    createdAt: bigint
    hasERC8004Identity: boolean
    erc8004AgentId: bigint
  }): AgentRecord {
    return {
      owner: agent.owner,
      signer: agent.signer,
      payoutRecipient: agent.payoutRecipient,
      vault: agent.vault,
      track: agent.track,
      status: agent.status,
      name: agent.name,
      metadataURI: agent.metadataURI,
      createdAt: agent.createdAt.toString(),
      hasERC8004Identity: agent.hasERC8004Identity,
      erc8004AgentId: agent.erc8004AgentId.toString(),
    }
  }

  async getEip712Domain(): Promise<{ name: string; version: string }> {
    const client = this.providerService.createPublicClient()
    const [, name, version] = await client.readContract({
      address: this.registryAddress,
      abi: agentRegistryAbi,
      functionName: 'eip712Domain',
    })
    return { name, version }
  }

  async getSelfRegisterTypehash(): Promise<Hex> {
    const client = this.providerService.createPublicClient()
    return client.readContract({
      address: this.registryAddress,
      abi: agentRegistryAbi,
      functionName: 'SELF_REGISTER_TYPEHASH',
    })
  }

  async signerOf(agentId: bigint): Promise<Address> {
    const client = this.providerService.createPublicClient()
    return client.readContract({
      address: this.registryAddress,
      abi: agentRegistryAbi,
      functionName: 'signerOf',
      args: [agentId],
    })
  }

  async vaultOf(agentId: bigint): Promise<Address> {
    const client = this.providerService.createPublicClient()
    return client.readContract({
      address: this.registryAddress,
      abi: agentRegistryAbi,
      functionName: 'vaultOf',
      args: [agentId],
    })
  }

  async registerWithRelayer(
    relayerPrivateKey: Hex,
    data: SelfRegisterTypedData
  ): Promise<{ agentId: string; transactionHash: Hex }> {
    const publicClient = this.providerService.createPublicClient()
    const walletClient =
      this.providerService.createWalletClient(relayerPrivateKey)

    const transactionHash = await walletClient.writeContract({
      address: this.registryAddress,
      abi: agentRegistryAbi,
      functionName: 'registerAgent',
      args: [
        data.signer,
        data.vault,
        data.name,
        data.metadataURI,
        data.signer,
        data.linkERC8004,
        data.erc8004AgentId,
      ],
    })

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: transactionHash,
    })
    if (receipt.status !== 'success') {
      throw new Error('On-chain registration transaction reverted')
    }

    let agentId: bigint | null = null
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== this.registryAddress.toLowerCase()) {
        continue
      }
      try {
        const decoded = decodeEventLog({
          abi: agentRegistryAbi,
          data: log.data,
          topics: log.topics,
        })
        if (decoded.eventName === 'AgentRegistered') {
          agentId = decoded.args.agentId
          break
        }
      } catch {
        // unrelated log
      }
    }

    if (agentId === null) {
      throw new Error('AgentRegistered event not found in receipt')
    }

    return { agentId: agentId.toString(), transactionHash }
  }
}
