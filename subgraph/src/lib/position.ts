import { Address, BigInt, Bytes } from '@graphprotocol/graph-ts'
import { PositionManager } from '../../generated/PositionManager/PositionManager'
import { ExitRule, Position } from '../../generated/schema'
import { exitRuleId, triggerTypeLabel } from './ids'

export function syncExitRules(
  positionManager: Address,
  position: Position,
  positionId: BigInt
): void {
  const contract = PositionManager.bind(positionManager)
  const rulesResult = contract.try_getExitRules(positionId)
  if (rulesResult.reverted) {
    return
  }

  const rules = rulesResult.value
  for (let index = 0; index < rules.length; index++) {
    const rule = rules[index]
    const entity = new ExitRule(exitRuleId(position.id, index))
    entity.position = position.id
    entity.index = index
    entity.triggerType = triggerTypeLabel(rule.triggerType)
    entity.triggerBps = rule.triggerBps
    entity.exitBps = rule.exitBps
    entity.save()
  }
}

export function loadOrCreatePosition(
  positionId: string,
  agentId: string
): Position {
  let position = Position.load(positionId)
  if (position == null) {
    position = new Position(positionId)
    position.agent = agentId
    position.vault = Bytes.empty()
    position.token = Bytes.empty()
    position.symbol = ''
    position.tokenAmount = BigInt.zero()
    position.entryPriceUsdc = BigInt.zero()
    position.usdcCostBasis = BigInt.zero()
    position.maxSlippageBps = 0
    position.status = 'Open'
    position.nextRuleIndex = 0
    position.openedAt = BigInt.zero()
    position.openedTxHash = Bytes.empty()
  }
  return position
}
