/** Default eth_getLogs window (thirdweb and many providers cap at 1000 blocks). */
export const MAX_LOG_BLOCK_RANGE = 999n

/** Bound Worker/RPC usage when an agent has no matching logs. */
export const MAX_CONSECUTIVE_EMPTY_LOG_CHUNKS = 32

export const MAX_LOG_SCAN_CHUNKS = 128

export function logScanWindow(
  toBlock: bigint,
  maxRange: bigint = MAX_LOG_BLOCK_RANGE,
  minScanBlock = 0n
): { fromBlock: bigint; toBlock: bigint } {
  const rawFrom = toBlock >= maxRange ? toBlock - maxRange + 1n : 0n
  const fromBlock = rawFrom < minScanBlock ? minScanBlock : rawFrom
  return { fromBlock, toBlock }
}

export function blockRangeSpan(fromBlock: bigint, toBlock: bigint): bigint {
  return toBlock - fromBlock + 1n
}

export function isLogBlockRangeLimitError(error: unknown): boolean {
  const parts: string[] = []
  let current: unknown = error

  for (let depth = 0; depth < 4 && current; depth++) {
    if (current instanceof Error) {
      parts.push(current.message)
    } else if (typeof current === 'object' && current !== null) {
      for (const key of ['message', 'details', 'shortMessage'] as const) {
        const value = (current as Record<string, unknown>)[key]
        if (typeof value === 'string') {
          parts.push(value)
        }
      }
      current = (current as { cause?: unknown }).cause
      continue
    }
    break
  }

  const combined = parts.join(' ').toLowerCase()
  return (
    combined.includes('maximum allowed number of requested blocks') ||
    combined.includes('eth_getlogs is limited') ||
    combined.includes('log response size exceeded') ||
    combined.includes('request exceeds defined limit')
  )
}

export async function fetchInAdaptiveBlockRange<T>(params: {
  fromBlock: bigint
  toBlock: bigint
  minBlockRange?: bigint
  fetch: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>
}): Promise<T[]> {
  const { fromBlock, toBlock, minBlockRange = 50n, fetch } = params

  try {
    return await fetch(fromBlock, toBlock)
  } catch (error) {
    if (!isLogBlockRangeLimitError(error)) {
      throw error
    }

    const span = blockRangeSpan(fromBlock, toBlock)
    if (span <= minBlockRange) {
      throw error
    }

    const mid = fromBlock + span / 2n
    const [left, right] = await Promise.all([
      fetchInAdaptiveBlockRange({
        fromBlock,
        toBlock: mid,
        minBlockRange,
        fetch,
      }),
      fetchInAdaptiveBlockRange({
        fromBlock: mid + 1n,
        toBlock,
        minBlockRange,
        fetch,
      }),
    ])

    return [...left, ...right]
  }
}

export function sortActivitiesNewestFirst(
  a: { blockNumber: string; logIndex: number },
  b: { blockNumber: string; logIndex: number }
): number {
  const blockDiff = Number(BigInt(b.blockNumber) - BigInt(a.blockNumber))
  if (blockDiff !== 0) {
    return blockDiff
  }
  return b.logIndex - a.logIndex
}
