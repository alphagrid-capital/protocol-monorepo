import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeTruthSocialItem,
  normalizeTruthSocialItems,
} from './load-signals.ts'

test('normalizeTruthSocialItem maps content and id fields', () => {
  const item = normalizeTruthSocialItem({
    id: 'post-1',
    content: 'Hello markets',
    createdAt: '2026-01-01T00:00:00.000Z',
  })
  assert.deepEqual(item, {
    id: 'post-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    text: 'Hello markets',
  })
})

test('normalizeTruthSocialItem truncates long text', () => {
  const item = normalizeTruthSocialItem({ text: 'a'.repeat(50) }, 20)
  assert.ok(item)
  assert.equal(item.text.length, 20)
  assert.ok(item.text.endsWith('…'))
})

test('normalizeTruthSocialItem returns null without text', () => {
  assert.equal(normalizeTruthSocialItem({ id: '1' }), null)
})

test('normalizeTruthSocialItems respects maxItems', () => {
  const items = normalizeTruthSocialItems(
    [
      { id: '1', content: 'one' },
      { id: '2', content: 'two' },
      { id: '3', content: 'three' },
    ],
    { maxItems: 2 }
  )
  assert.equal(items.length, 2)
  assert.equal(items[0]?.id, '1')
  assert.equal(items[1]?.id, '2')
})
