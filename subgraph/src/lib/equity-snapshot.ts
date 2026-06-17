import { BigInt, ethereum } from '@graphprotocol/graph-ts'
import { TradeRouter } from '../../generated/AllocationManager/TradeRouter'
import { TradeRouterLens } from '../../generated/AllocationManager/TradeRouterLens'
import { AgentEquitySnapshot, Allocation } from '../../generated/schema'
import { equitySnapshotId } from './ids'
import {
  tradeRouterAddress,
  tradeRouterLensAddress,
} from './network-contracts'

export function recordEquitySnapshot(
  agentId: string,
  agentIdValue: BigInt,
  event: ethereum.Event,
  trigger: string
): void {
  const lens = TradeRouterLens.bind(tradeRouterLensAddress())
  const equityResult = lens.try_currentEquityUsdc(agentIdValue)
  const peakResult = lens.try_peakEquityUsdc(agentIdValue)
  const drawdownResult = lens.try_currentDrawdownBps(agentIdValue)
  if (
    equityResult.reverted ||
    peakResult.reverted ||
    drawdownResult.reverted
  ) {
    return
  }

  const router = TradeRouter.bind(tradeRouterAddress())
  const lifetimeResult = router.try_lifetimeRealizedPnlUsdc(agentIdValue)
  if (lifetimeResult.reverted) {
    return
  }

  const allocation = Allocation.load(agentId)
  const cap = allocation != null ? allocation.cap : BigInt.zero()
  const equity = equityResult.value
  const lifetimeRealized = lifetimeResult.value
  const unrealized = equity.minus(cap).minus(lifetimeRealized)

  const snapshot = new AgentEquitySnapshot(
    equitySnapshotId(agentId, event.block.number, event.logIndex.toI32())
  )
  snapshot.agent = agentId
  snapshot.blockNumber = event.block.number
  snapshot.blockTimestamp = event.block.timestamp
  snapshot.transactionHash = event.transaction.hash
  snapshot.logIndex = event.logIndex.toI32()
  snapshot.trigger = trigger
  snapshot.allocationCap = cap
  snapshot.lifetimeRealizedPnlUsdc = lifetimeRealized
  snapshot.unrealizedPnlUsdc = unrealized
  snapshot.equityUsdc = equity
  snapshot.peakEquityUsdc = peakResult.value
  snapshot.drawdownBps = drawdownResult.value.toI32()
  if (!cap.equals(BigInt.zero())) {
    const delta = equity.minus(cap)
    snapshot.returnBps = delta.times(BigInt.fromI32(10000)).div(cap).toI32()
  }
  snapshot.save()
}
