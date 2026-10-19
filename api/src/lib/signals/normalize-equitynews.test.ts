import assert from 'node:assert/strict'
import test from 'node:test'
import {
  equityNewsCacheKey,
  normalizeEquityNewsItem,
  normalizeEquityNewsItems,
} from './load-signals.ts'

test('equityNewsCacheKey sorts and uppercases symbols', () => {
  assert.equal(equityNewsCacheKey(['nvda', 'AAPL']), 'equitynews:AAPL,NVDA')
})

test('normalizeEquityNewsItem maps headline + summary', () => {
  const item = normalizeEquityNewsItem({
    headline: 'NVDA jumps on AI demand',
    summary: 'Chipmaker rallies after broker upgrade.',
    articleLink: 'https://example.com/nvda',
    publishedDate: '2026-10-19T22:00:00.000Z',
    tickers: ['NVDA', 'AMD'],
  })
  assert.deepEqual(item, {
    id: 'https://example.com/nvda',
    createdAt: '2026-10-19T22:00:00.000Z',
    text: '[NVDA,AMD] NVDA jumps on AI demand — Chipmaker rallies after broker upgrade.',
  })
})

test('normalizeEquityNewsItem truncates long text', () => {
  const item = normalizeEquityNewsItem(
    { headline: 'a'.repeat(50), dedupeKey: 'k1' },
    20
  )
  assert.ok(item)
  assert.equal(item.text.length, 20)
  assert.ok(item.text.endsWith('…'))
})

test('normalizeEquityNewsItem returns null without headline', () => {
  assert.equal(normalizeEquityNewsItem({ articleLink: 'x' }), null)
})

test('normalizeEquityNewsItems dedupes and respects maxItems', () => {
  const items = normalizeEquityNewsItems(
    [
      { headline: 'one', dedupeKey: 'a' },
      { headline: 'two', dedupeKey: 'a' },
      { headline: 'three', dedupeKey: 'b' },
      { headline: 'four', dedupeKey: 'c' },
    ],
    { maxItems: 2 }
  )
  assert.equal(items.length, 2)
  assert.equal(items[0]?.id, 'a')
  assert.equal(items[1]?.id, 'b')
})
