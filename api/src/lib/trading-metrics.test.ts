import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  accountReturnBps,
  accountUnrealizedUsdc,
  buildPromotionReadiness,
  dailyLossUsedUsdc,
  maxDailyLossUsdc,
  positionReturnBps,
  utilizationBps,
  utilizationBpsFromBigint,
} from './trading-metrics.ts'

describe('trading-metrics', () => {
  it('accountReturnBps', () => {
    assert.equal(accountReturnBps(0n, 100n), null)
    assert.equal(accountReturnBps(100_000_000n, 110_000_000n), 1000)
    assert.equal(accountReturnBps(100_000_000n, 90_000_000n), -1000)
  })

  it('utilizationBps', () => {
    assert.equal(utilizationBps(750, 1000), 7500)
    assert.equal(utilizationBps(100, 0), null)
  })

  it('maxDailyLossUsdc and dailyLossUsedUsdc', () => {
    assert.equal(maxDailyLossUsdc(10_000_000_000n, 500), 500_000_000n)
    assert.equal(dailyLossUsedUsdc(-250_000n), 250_000n)
    assert.equal(dailyLossUsedUsdc(100n), 0n)
  })

  it('accountUnrealizedUsdc', () => {
    assert.equal(
      accountUnrealizedUsdc(100_000_000n, 5_000_000n, 108_000_000n),
      3_000_000n
    )
  })

  it('positionReturnBps', () => {
    assert.equal(positionReturnBps(0n, 1_000_000n), null)
    assert.equal(positionReturnBps(10_000_000n, 1_000_000n), 1000)
  })

  it('utilizationBpsFromBigint', () => {
    assert.equal(utilizationBpsFromBigint(250_000n, 1_000_000n), 2500)
  })

  it('buildPromotionReadiness', () => {
    const ready = buildPromotionReadiness({
      minTrades: 5,
      positionsClosed: 6,
      evaluationPeriodSeconds: 1000n,
      createdAtSeconds: 0n,
      nowSeconds: 2000n,
      promotionScoreRequired: 70,
      drawdownBreached: false,
      dailyLossBreached: false,
      agentStatus: 1,
      agentStatusActive: 1,
    })
    assert.equal(ready.meetsMinTrades, true)
    assert.equal(ready.meetsEvaluationPeriod, true)
    assert.equal(ready.eligible, false)
    assert.ok(ready.blockers.includes('alpha_score_unavailable'))

    const blocked = buildPromotionReadiness({
      minTrades: 5,
      positionsClosed: 2,
      evaluationPeriodSeconds: 1000n,
      createdAtSeconds: 0n,
      nowSeconds: 500n,
      promotionScoreRequired: 70,
      drawdownBreached: true,
      dailyLossBreached: false,
      agentStatus: 1,
      agentStatusActive: 1,
    })
    assert.ok(blocked.blockers.includes('min_trades_not_met'))
    assert.ok(blocked.blockers.includes('evaluation_period_not_met'))
    assert.ok(blocked.blockers.includes('drawdown_breached'))
  })
})
