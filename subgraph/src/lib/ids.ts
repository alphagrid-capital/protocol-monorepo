import { BigInt, Bytes } from '@graphprotocol/graph-ts'

export const POSITION_STATUS_OPEN = 'Open'
export const POSITION_STATUS_CLOSED = 'Closed'

export const ACTIVITY_SOURCE_TRADE_ROUTER = 'TradeRouter'
export const ACTIVITY_SOURCE_POSITION_MANAGER = 'PositionManager'

export function agentIdToString(agentId: BigInt): string {
  return agentId.toString()
}

export function positionIdToString(positionId: BigInt): string {
  return positionId.toString()
}

export function activityId(txHash: Bytes, logIndex: number): string {
  return txHash.toHexString().concat('-').concat(logIndex.toString())
}

export function exitRuleId(positionId: string, index: number): string {
  return positionId.concat('-').concat(index.toString())
}

export function equitySnapshotId(
  agentId: string,
  blockNumber: BigInt,
  logIndex: number
): string {
  return agentId
    .concat('-')
    .concat(blockNumber.toString())
    .concat('-')
    .concat(logIndex.toString())
}

export function triggerTypeLabel(triggerType: number): string {
  if (triggerType == 0) {
    return 'StopLoss'
  }
  return 'TakeProfit'
}
