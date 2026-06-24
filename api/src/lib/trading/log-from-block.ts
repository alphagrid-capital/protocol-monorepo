/** Lower bound for eth_getLogs when scanning trade activity. */
export function resolveMinLogScanBlock(params: {
  chainFromBlock: bigint | null | undefined
  queryFromBlock?: bigint
}): bigint {
  const { chainFromBlock, queryFromBlock } = params
  let min = 0n
  if (chainFromBlock !== null && chainFromBlock !== undefined) {
    min = chainFromBlock
  }
  if (queryFromBlock !== undefined && queryFromBlock > min) {
    min = queryFromBlock
  }
  return min
}
