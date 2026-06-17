import { BigInt } from '@graphprotocol/graph-ts'
import {
  AgentOwnershipTransferred,
  AgentPromoted,
  AgentRegistered,
  AgentSignerUpdated,
  AgentStatusChanged,
  ERC8004IdentityLinked,
} from '../generated/AgentRegistry/AgentRegistry'
import { AgentRegistry } from '../generated/AgentRegistry/AgentRegistry'
import { loadOrCreateAgent } from './lib/entities'
import { agentIdToString } from './lib/ids'

function syncAgentFromChain(agentId: string, registry: AgentRegistry): void {
  const agent = loadOrCreateAgent(agentId)
  const onChain = registry.try_getAgent(BigInt.fromString(agentId))
  if (onChain.reverted) {
    agent.save()
    return
  }

  const record = onChain.value
  agent.owner = record.owner
  agent.signer = record.signer
  agent.payoutRecipient = record.payoutRecipient
  agent.vault = record.vault
  agent.track = record.track
  agent.status = record.status
  agent.name = record.name
  agent.metadataURI = record.metadataURI
  agent.createdAt = record.createdAt
  agent.hasERC8004Identity = record.hasERC8004Identity
  agent.erc8004AgentId = record.erc8004AgentId
  agent.save()
}

export function handleAgentRegistered(event: AgentRegistered): void {
  const agentId = agentIdToString(event.params.agentId)
  const registry = AgentRegistry.bind(event.address)
  syncAgentFromChain(agentId, registry)
}

export function handleAgentStatusChanged(event: AgentStatusChanged): void {
  const agentId = agentIdToString(event.params.agentId)
  const agent = loadOrCreateAgent(agentId)
  agent.status = event.params.newStatus
  agent.save()
}

export function handleAgentPromoted(event: AgentPromoted): void {
  const agentId = agentIdToString(event.params.agentId)
  const agent = loadOrCreateAgent(agentId)
  agent.vault = event.params.vault
  agent.track = event.params.toTrack
  agent.save()
}

export function handleAgentSignerUpdated(event: AgentSignerUpdated): void {
  const agentId = agentIdToString(event.params.agentId)
  const agent = loadOrCreateAgent(agentId)
  agent.signer = event.params.signer
  agent.save()
}

export function handleAgentOwnershipTransferred(
  event: AgentOwnershipTransferred
): void {
  const agentId = agentIdToString(event.params.agentId)
  const agent = loadOrCreateAgent(agentId)
  agent.owner = event.params.to
  agent.save()
}

export function handleErc8004IdentityLinked(event: ERC8004IdentityLinked): void {
  const agentId = agentIdToString(event.params.agentId)
  const agent = loadOrCreateAgent(agentId)
  agent.hasERC8004Identity = true
  agent.erc8004AgentId = event.params.erc8004AgentId
  agent.save()
}
