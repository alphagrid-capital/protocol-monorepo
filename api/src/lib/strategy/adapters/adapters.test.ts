import assert from 'node:assert/strict'
import test from 'node:test'
import { strategyContextExample } from '../context.example.ts'
import { noneStrategyDecisionAdapter } from './none.ts'

test('none adapter returns hold decision', async () => {
  const decision = await noneStrategyDecisionAdapter.decide(
    strategyContextExample
  )

  assert.equal(decision.summary, 'Hold — no trades recommended.')
  assert.deepEqual(decision.actions, [])
})
