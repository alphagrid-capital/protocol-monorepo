import assert from 'node:assert/strict'
import test from 'node:test'
import {
  blockRangeSpan,
  fetchInAdaptiveBlockRange,
  isLogBlockRangeLimitError,
  logScanWindow,
  MAX_LOG_BLOCK_RANGE,
  sortActivitiesNewestFirst,
} from './trade-log-scan.ts'

test('logScanWindow caps range at maxRange blocks', () => {
  assert.deepEqual(logScanWindow(50_000n), {
    fromBlock: 49_002n,
    toBlock: 50_000n,
  })
})

test('logScanWindow starts at genesis when toBlock is below max range', () => {
  assert.deepEqual(logScanWindow(100n), {
    fromBlock: 0n,
    toBlock: 100n,
  })
})

test('logScanWindow uses exactly maxRange blocks when aligned', () => {
  const window = logScanWindow(MAX_LOG_BLOCK_RANGE)
  assert.equal(
    blockRangeSpan(window.fromBlock, window.toBlock),
    MAX_LOG_BLOCK_RANGE
  )
})

test('isLogBlockRangeLimitError detects provider block caps', () => {
  assert.equal(
    isLogBlockRangeLimitError(
      new Error(
        'Log response size exceeded. Maximum allowed number of requested blocks is 1000'
      )
    ),
    true
  )
  assert.equal(isLogBlockRangeLimitError(new Error('agent not found')), false)
})

test('fetchInAdaptiveBlockRange splits on block cap errors', async () => {
  const calls: [bigint, bigint][] = []

  const logs = await fetchInAdaptiveBlockRange({
    fromBlock: 0n,
    toBlock: 999n,
    minBlockRange: 100n,
    fetch: async (fromBlock, toBlock) => {
      calls.push([fromBlock, toBlock])
      if (blockRangeSpan(fromBlock, toBlock) > 500n) {
        throw new Error(
          'Log response size exceeded. Maximum allowed number of requested blocks is 1000'
        )
      }
      return [{ fromBlock, toBlock }]
    },
  })

  assert.ok(calls.length > 1)
  assert.ok(logs.length > 1)
})

test('sortActivitiesNewestFirst orders by block then logIndex', () => {
  const sorted = [
    { blockNumber: '10', logIndex: 1 },
    { blockNumber: '11', logIndex: 0 },
    { blockNumber: '10', logIndex: 3 },
  ].sort(sortActivitiesNewestFirst)

  assert.deepEqual(
    sorted.map((item) => [item.blockNumber, item.logIndex]),
    [
      ['11', 0],
      ['10', 3],
      ['10', 1],
    ]
  )
})
