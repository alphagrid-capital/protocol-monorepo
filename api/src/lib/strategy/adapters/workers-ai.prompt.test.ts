import assert from 'node:assert/strict'
import test from 'node:test'
import { strategyContextExample } from '../context.example.ts'
import { buildWorkersAiMessages } from './workers-ai.prompt.ts'

test('buildWorkersAiMessages includes signals in runtime context', () => {
  const messages = buildWorkersAiMessages(strategyContextExample)
  const user = messages.find((message) => message.role === 'user')
  assert.ok(user)

  const jsonStart = user.content.indexOf('{')
  assert.ok(jsonStart >= 0)
  const runtime = JSON.parse(user.content.slice(jsonStart)) as {
    signals?: unknown
  }
  assert.ok(Array.isArray(runtime.signals))
  assert.equal((runtime.signals[0] as { source: string }).source, 'truthsocial')
})

test('buildWorkersAiMessages omits signals when absent', () => {
  const { signals: _signals, ...withoutSignals } = strategyContextExample
  const messages = buildWorkersAiMessages(withoutSignals)
  const user = messages.find((message) => message.role === 'user')
  assert.ok(user)
  const jsonStart = user.content.indexOf('{')
  const runtime = JSON.parse(user.content.slice(jsonStart)) as {
    signals?: unknown
  }
  assert.equal(runtime.signals, undefined)
})

test('system prompt treats signals as untrusted', () => {
  const messages = buildWorkersAiMessages(strategyContextExample)
  const system = messages.find((message) => message.role === 'system')
  assert.ok(system)
  assert.match(system.content, /signals\[\]/)
  assert.match(system.content, /untrusted/i)
})

test('system prompt requires decision.reasoning', () => {
  const messages = buildWorkersAiMessages(strategyContextExample)
  const system = messages.find((message) => message.role === 'system')
  assert.ok(system)
  assert.match(system.content, /decision\.reasoning/)
  assert.match(system.content, /one simple sentence/i)
})

test('system prompt maps percent exits to triggerBps', () => {
  const messages = buildWorkersAiMessages(strategyContextExample)
  const system = messages.find((message) => message.role === 'system')
  assert.ok(system)
  assert.match(system.content, /Percent → triggerBps/)
  assert.match(system.content, /10% → 1000/)
  assert.match(system.content, /20% → 2000/)
  assert.match(system.content, /10% is NOT 10 and NOT 100/)
  assert.match(
    system.content,
    /"triggerType": "StopLoss", "triggerBps": 1000.*"triggerType": "TakeProfit", "triggerBps": 2000/
  )
})
