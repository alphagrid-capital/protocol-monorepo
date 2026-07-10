export function toOnChainTriggerBps(
  triggerType: 'StopLoss' | 'TakeProfit',
  triggerBps: number
): bigint {
  const magnitude = Math.abs(triggerBps)
  return BigInt(triggerType === 'StopLoss' ? -magnitude : magnitude)
}
