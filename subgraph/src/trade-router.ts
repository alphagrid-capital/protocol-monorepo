import { BigInt, ethereum } from '@graphprotocol/graph-ts'
import {
  ExitExecuted,
  PositionExitLadderUpdatedFromIntent,
  PositionForceClosed,
  PositionIncreasedFromIntent,
  PositionOpenedFromIntent,
  PositionReducedFromIntent,
} from '../generated/TradeRouter/TradeRouter'
import { AgentActivity } from '../generated/schema'
import { loadOrCreateAgent } from './lib/entities'
import {
  ACTIVITY_SOURCE_TRADE_ROUTER,
  activityId,
  agentIdToString,
  positionIdToString,
} from './lib/ids'
import { loadOrCreatePosition } from './lib/position'
import { symbolForToken } from './lib/token-symbol'

function saveTradeRouterActivity(
  event: ethereum.Event,
  agentId: string,
  positionId: string,
  activityType: string
): AgentActivity {
  loadOrCreateAgent(agentId)
  loadOrCreatePosition(positionId, agentId)

  const activity = new AgentActivity(
    activityId(event.transaction.hash, event.logIndex.toI32())
  )
  activity.agent = agentId
  activity.position = positionId
  activity.type = activityType
  activity.source = ACTIVITY_SOURCE_TRADE_ROUTER
  activity.blockNumber = event.block.number
  activity.blockTimestamp = event.block.timestamp
  activity.transactionHash = event.transaction.hash
  activity.logIndex = event.logIndex.toI32()
  return activity
}

export function handlePositionOpenedFromIntent(
  event: PositionOpenedFromIntent
): void {
  const agentId = agentIdToString(event.params.agentId)
  const positionId = positionIdToString(event.params.positionId)
  const activity = saveTradeRouterActivity(
    event,
    agentId,
    positionId,
    'PositionOpened'
  )
  activity.vault = event.params.vault
  activity.token = event.params.token
  activity.symbol = symbolForToken(event.params.token)
  activity.usdcIn = event.params.usdcIn
  activity.save()
}

export function handlePositionIncreasedFromIntent(
  event: PositionIncreasedFromIntent
): void {
  const agentId = agentIdToString(event.params.agentId)
  const positionId = positionIdToString(event.params.positionId)
  const activity = saveTradeRouterActivity(
    event,
    agentId,
    positionId,
    'PositionIncreased'
  )
  activity.usdcIn = event.params.usdcIn
  activity.tokensAdded = event.params.tokensAdded
  activity.save()
}

export function handlePositionReducedFromIntent(
  event: PositionReducedFromIntent
): void {
  const agentId = agentIdToString(event.params.agentId)
  const positionId = positionIdToString(event.params.positionId)
  const activity = saveTradeRouterActivity(
    event,
    agentId,
    positionId,
    'PositionReduced'
  )
  activity.exitBps = event.params.exitBps
  activity.usdcOut = event.params.usdcOut
  activity.save()
}

export function handlePositionExitLadderUpdatedFromIntent(
  event: PositionExitLadderUpdatedFromIntent
): void {
  const agentId = agentIdToString(event.params.agentId)
  const positionId = positionIdToString(event.params.positionId)
  const activity = saveTradeRouterActivity(
    event,
    agentId,
    positionId,
    'ExitLadderUpdated'
  )
  activity.nextRuleIndex = event.params.nextRuleIndex
  activity.save()
}

export function handleExitExecuted(event: ExitExecuted): void {
  const agentId = agentIdToString(event.params.agentId)
  const positionId = positionIdToString(event.params.positionId)
  const activity = saveTradeRouterActivity(
    event,
    agentId,
    positionId,
    'ExitExecuted'
  )
  activity.ruleIndex = event.params.ruleIndex
  activity.keeper = event.params.keeper
  activity.usdcOut = event.params.usdcOut
  activity.keeperBounty = event.params.keeperBounty
  activity.save()
}

export function handlePositionForceClosed(event: PositionForceClosed): void {
  const agentId = agentIdToString(event.params.agentId)
  const positionId = positionIdToString(event.params.positionId)
  const activity = saveTradeRouterActivity(
    event,
    agentId,
    positionId,
    'PositionForceClosed'
  )
  activity.operator = event.params.operator
  activity.usdcOut = event.params.usdcOut
  activity.save()
}
