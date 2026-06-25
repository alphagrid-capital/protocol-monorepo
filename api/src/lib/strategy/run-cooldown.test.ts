import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getStrategyRunCooldown,
  loadStrategyRunManualCooldownMs,
} from './run-cooldown.ts'

describe('strategy run cooldown', () => {
  it('defaults to five minutes', () => {
    assert.equal(loadStrategyRunManualCooldownMs({}), 5 * 60 * 1000)
  })

  it('reads STRATEGY_RUN_MANUAL_COOLDOWN_SECONDS override', () => {
    assert.equal(
      loadStrategyRunManualCooldownMs({
        STRATEGY_RUN_MANUAL_COOLDOWN_SECONDS: '120',
      }),
      120 * 1000
    )
  })

  it('allows run when no previous run exists', () => {
    assert.deepEqual(getStrategyRunCooldown(null, 300_000), { allowed: true })
  })

  it('blocks run within cooldown window', () => {
    const now = Date.parse('2026-06-25T12:00:00.000Z')
    const result = getStrategyRunCooldown(
      '2026-06-25T11:58:00.000Z',
      300_000,
      now
    )

    assert.equal(result.allowed, false)
    if (!result.allowed) {
      assert.equal(result.retryAfterSeconds, 180)
    }
  })

  it('allows run after cooldown window', () => {
    const now = Date.parse('2026-06-25T12:06:00.000Z')
    assert.deepEqual(
      getStrategyRunCooldown('2026-06-25T12:00:00.000Z', 300_000, now),
      { allowed: true }
    )
  })
})
