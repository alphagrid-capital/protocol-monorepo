import { BigInt } from '@graphprotocol/graph-ts'
import {
  AllocationCreated,
  AllocationUpdated,
  AllocationUsedUpdated,
} from '../generated/AllocationManager/AllocationManager'
import { Allocation } from '../generated/schema'
import { loadOrCreateAgent } from './lib/entities'
import { recordEquitySnapshot } from './lib/equity-snapshot'
import { agentIdToString } from './lib/ids'

function loadOrCreateAllocation(agentId: string): Allocation {
  let allocation = Allocation.load(agentId)
  if (allocation == null) {
    allocation = new Allocation(agentId)
    allocation.agent = agentId
    allocation.vault = loadOrCreateAgent(agentId).vault
    allocation.trackId = BigInt.zero()
    allocation.cap = BigInt.zero()
    allocation.used = BigInt.zero()
    allocation.status = 0
    allocation.createdAt = BigInt.zero()
    allocation.updatedAt = BigInt.zero()
  }
  return allocation
}

export function handleAllocationCreated(event: AllocationCreated): void {
  const agentId = agentIdToString(event.params.agentId)
  loadOrCreateAgent(agentId)

  const allocation = loadOrCreateAllocation(agentId)
  allocation.vault = event.params.vault
  allocation.trackId = event.params.trackId
  allocation.cap = event.params.cap
  allocation.used = BigInt.zero()
  allocation.status = 0
  allocation.createdAt = event.block.timestamp
  allocation.updatedAt = event.block.timestamp
  allocation.save()

  recordEquitySnapshot(
    agentId,
    event.params.agentId,
    event,
    'AllocationCreated'
  )
}

export function handleAllocationUpdated(event: AllocationUpdated): void {
  const agentId = agentIdToString(event.params.agentId)
  const allocation = loadOrCreateAllocation(agentId)
  allocation.vault = event.params.vault
  allocation.trackId = event.params.trackId
  allocation.cap = event.params.cap
  allocation.status = event.params.status
  allocation.updatedAt = event.block.timestamp
  allocation.save()

  recordEquitySnapshot(
    agentId,
    event.params.agentId,
    event,
    'AllocationUpdated'
  )
}

export function handleAllocationUsedUpdated(event: AllocationUsedUpdated): void {
  const agentId = agentIdToString(event.params.agentId)
  const allocation = loadOrCreateAllocation(agentId)
  allocation.used = event.params.used
  allocation.updatedAt = event.block.timestamp
  allocation.save()
}
