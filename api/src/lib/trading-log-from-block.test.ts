import assert from 'node:assert/strict'
import test from 'node:test'
import { logScanWindow } from './agent-trade-log-scan.ts'
import { resolveMinLogScanBlock } from './trading-log-from-block.ts'

test('resolveMinLogScanBlock uses chain floor and query override', () => {
  assert.equal(
    resolveMinLogScanBlock({
      chainFromBlock: 100n,
      queryFromBlock: 200n,
    }),
    200n
  )
  assert.equal(
    resolveMinLogScanBlock({
      chainFromBlock: 100n,
    }),
    100n
  )
})

test('logScanWindow clamps fromBlock to minScanBlock', () => {
  assert.deepEqual(logScanWindow(50_000n, 999n, 49_500n), {
    fromBlock: 49_500n,
    toBlock: 50_000n,
  })
})
