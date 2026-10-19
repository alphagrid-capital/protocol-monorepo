import assert from 'node:assert/strict'
import test from 'node:test'
import { strategyContextExample } from '../context.example.ts'
import { noneStrategyDecisionAdapter } from './none.ts'
import { resolveStrategyDecisionMeta } from './decision-meta.ts'

test('none adapter returns hold decision', async () => {
  const decision = await noneStrategyDecisionAdapter.decide(
    strategyContextExample
  )

  assert.equal(decision.status, 'ok')
  assert.equal(decision.summary, 'Hold — no trades recommended.')
  if (decision.status === 'ok') {
    assert.equal(
      decision.reasoning,
      'Decision provider is disabled; no trades recommended.'
    )
  }
  assert.deepEqual(decision.actions, [])
})

test('resolveStrategyDecisionMeta defaults to workers-ai model', () => {
  const meta = resolveStrategyDecisionMeta({})
  assert.equal(meta.provider, 'workers-ai')
  assert.equal(meta.modelId, '@cf/meta/llama-3.3-70b-instruct-fp8-fast')
})

test('resolveStrategyDecisionMeta reads bedrock model without AWS keys', () => {
  const meta = resolveStrategyDecisionMeta({
    STRATEGY_DECISION_PROVIDER: 'bedrock',
    BEDROCK_MODEL_ID: 'eu.amazon.nova-micro-v1:0',
  })
  assert.equal(meta.provider, 'bedrock')
  assert.equal(meta.modelId, 'eu.amazon.nova-micro-v1:0')
})

test('resolveStrategyDecisionMeta none has null model', () => {
  const meta = resolveStrategyDecisionMeta({
    STRATEGY_DECISION_PROVIDER: 'none',
  })
  assert.equal(meta.provider, 'none')
  assert.equal(meta.modelId, null)
})
