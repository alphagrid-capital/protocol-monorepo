import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_FRED_SERIES_IDS,
  fredCacheKey,
  normalizeFredSnapshot,
  normalizeFredSnapshots,
  resolveFredSeriesIds,
} from './load-signals.ts'

test('resolveFredSeriesIds falls back to defaults', () => {
  assert.deepEqual(resolveFredSeriesIds(undefined), [
    ...DEFAULT_FRED_SERIES_IDS,
  ])
  assert.deepEqual(resolveFredSeriesIds([]), [...DEFAULT_FRED_SERIES_IDS])
})

test('fredCacheKey sorts series ids', () => {
  assert.equal(fredCacheKey(['DFF', 'UNRATE']), 'fred:DFF,UNRATE')
})

test('normalizeFredSnapshot formats value and prior', () => {
  const item = normalizeFredSnapshot({
    seriesId: 'UNRATE',
    title: 'Unemployment Rate',
    date: '2026-09-01',
    value: '4.1',
    priorDate: '2026-08-01',
    priorValue: '4.2',
  })
  assert.equal(item.id, 'fred:UNRATE:2026-09-01')
  assert.equal(item.createdAt, '2026-09-01T00:00:00.000Z')
  assert.equal(
    item.text,
    'UNRATE (Unemployment Rate): 4.1 (2026-09-01); prior 4.2 (2026-08-01)'
  )
})

test('normalizeFredSnapshots respects maxItems', () => {
  const items = normalizeFredSnapshots(
    [
      {
        seriesId: 'A',
        title: 'A',
        date: '2026-01-01',
        value: '1',
      },
      {
        seriesId: 'B',
        title: 'B',
        date: '2026-01-01',
        value: '2',
      },
    ],
    { maxItems: 1 }
  )
  assert.equal(items.length, 1)
  assert.equal(items[0]?.id, 'fred:A:2026-01-01')
})
