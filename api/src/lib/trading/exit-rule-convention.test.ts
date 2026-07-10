import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { toOnChainTriggerBps } from './exit-rule-convention.ts'

describe('exit-rule convention', () => {
  it('maps AI stop-loss magnitudes to signed on-chain bps', () => {
    assert.equal(toOnChainTriggerBps('StopLoss', 1500), -1500n)
  })

  it('preserves signed stop-loss defaults', () => {
    assert.equal(toOnChainTriggerBps('StopLoss', -1000), -1000n)
  })

  it('maps take-profits to positive on-chain bps', () => {
    assert.equal(toOnChainTriggerBps('TakeProfit', 2500), 2500n)
    assert.equal(toOnChainTriggerBps('TakeProfit', -2500), 2500n)
  })
})
