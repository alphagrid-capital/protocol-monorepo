import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts'
import {
  PositionClosed,
  PositionExitLadderUpdated,
  PositionIncreased,
  PositionLadderExitApplied,
  PositionOpened,
  PositionReduced,
} from '../generated/PositionManager/PositionManager'
import { PositionManager } from '../generated/PositionManager/PositionManager'
import { AgentActivity } from '../generated/schema'
import { loadOrCreateAgent } from './lib/entities'
import {
  ACTIVITY_SOURCE_POSITION_MANAGER,
  POSITION_STATUS_CLOSED,
  POSITION_STATUS_OPEN,
  activityId,
  agentIdToString,
  positionIdToString,
} from './lib/ids'
import { loadOrCreatePosition, syncExitRules } from './lib/position'
import { recordEquitySnapshot } from './lib/equity-snapshot'
import { symbolForToken } from './lib/token-symbol'

function applyPositionFromChain(
  positionManagerAddress: Address,
  positionId: BigInt
): void {
  const positionManager = PositionManager.bind(positionManagerAddress)
  const positionKey = positionIdToString(positionId)
  const onChain = positionManager.try_getPosition(positionId)
  if (onChain.reverted) {
    return
  }

  const record = onChain.value
  const agentId = agentIdToString(record.agentId)
  loadOrCreateAgent(agentId)

  const position = loadOrCreatePosition(positionKey, agentId)
  position.vault = record.vault
  position.token = record.token
  position.symbol = symbolForToken(record.token)
  position.tokenAmount = record.tokenAmount
  position.entryPriceUsdc = record.entryPriceUsdc
  position.usdcCostBasis = record.usdcCostBasis
  position.maxSlippageBps = record.maxSlippageBps
  position.nextRuleIndex = record.nextRuleIndex
  position.openedAt = record.openedAt
  position.status =
    record.status == 0 ? POSITION_STATUS_OPEN : POSITION_STATUS_CLOSED
  if (record.status == 1) {
    position.realizedPnlUsdc = record.realizedPnlUsdc
  }
  position.save()

  syncExitRules(positionManagerAddress, position, positionId)
}

function recordPositionClosedActivity(
  event: ethereum.Event,
  agentId: string,
  positionId: string,
  realizedPnlUsdc: BigInt
): void {
  const activity = new AgentActivity(
    activityId(event.transaction.hash, event.logIndex.toI32())
  )
  activity.agent = agentId
  activity.position = positionId
  activity.type = 'PositionClosed'
  activity.source = ACTIVITY_SOURCE_POSITION_MANAGER
  activity.blockNumber = event.block.number
  activity.blockTimestamp = event.block.timestamp
  activity.transactionHash = event.transaction.hash
  activity.logIndex = event.logIndex.toI32()
  activity.realizedPnlUsdc = realizedPnlUsdc
  activity.save()
}

export function handlePositionOpened(event: PositionOpened): void {
  const positionId = event.params.positionId
  const agentId = agentIdToString(event.params.agentId)
  const agent = loadOrCreateAgent(agentId)
  agent.positionsOpened = agent.positionsOpened + 1
  agent.openPositionCount = agent.openPositionCount + 1
  agent.save()

  const positionKey = positionIdToString(positionId)
  const position = loadOrCreatePosition(positionKey, agentId)
  position.vault = event.params.vault
  position.token = event.params.token
  position.symbol = symbolForToken(event.params.token)
  position.tokenAmount = event.params.tokenAmount
  position.entryPriceUsdc = event.params.entryPriceUsdc
  position.usdcCostBasis = event.params.usdcCostBasis
  position.status = POSITION_STATUS_OPEN
  position.openedAt = event.block.timestamp
  position.openedTxHash = event.transaction.hash
  position.save()

  applyPositionFromChain(event.address, positionId)
  recordEquitySnapshot(
    agentId,
    event.params.agentId,
    event,
    'PositionOpened'
  )
}

export function handlePositionIncreased(event: PositionIncreased): void {
  applyPositionFromChain(event.address, event.params.positionId)
  const agentId = agentIdToString(event.params.agentId)
  recordEquitySnapshot(
    agentId,
    event.params.agentId,
    event,
    'PositionIncreased'
  )
}

export function handlePositionReduced(event: PositionReduced): void {
  applyPositionFromChain(event.address, event.params.positionId)
  const agentId = agentIdToString(event.params.agentId)
  recordEquitySnapshot(
    agentId,
    event.params.agentId,
    event,
    'PositionReduced'
  )
}

export function handlePositionLadderExitApplied(
  event: PositionLadderExitApplied
): void {
  applyPositionFromChain(event.address, event.params.positionId)
  const agentId = agentIdToString(event.params.agentId)
  recordEquitySnapshot(
    agentId,
    event.params.agentId,
    event,
    'PositionLadderExitApplied'
  )
}

export function handlePositionExitLadderUpdated(
  event: PositionExitLadderUpdated
): void {
  applyPositionFromChain(event.address, event.params.positionId)
}

export function handlePositionClosed(event: PositionClosed): void {
  const positionId = event.params.positionId
  const agentId = agentIdToString(event.params.agentId)
  const agent = loadOrCreateAgent(agentId)
  if (agent.openPositionCount > 0) {
    agent.openPositionCount = agent.openPositionCount - 1
  }
  agent.positionsClosed = agent.positionsClosed + 1
  agent.save()

  applyPositionFromChain(event.address, positionId)

  const positionKey = positionIdToString(positionId)
  const position = loadOrCreatePosition(positionKey, agentId)
  position.status = POSITION_STATUS_CLOSED
  position.closedAt = event.block.timestamp
  position.closedTxHash = event.transaction.hash
  position.realizedPnlUsdc = event.params.realizedPnlUsdc
  position.save()

  recordPositionClosedActivity(
    event,
    agentId,
    positionKey,
    event.params.realizedPnlUsdc
  )

  recordEquitySnapshot(
    agentId,
    event.params.agentId,
    event,
    'PositionClosed'
  )
}
