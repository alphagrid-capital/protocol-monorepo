export function atomicUsdcToUsdString(amount: bigint, decimals = 6): string {
  const whole = amount / 10n ** BigInt(decimals)
  const frac = amount % 10n ** BigInt(decimals)
  if (frac === 0n) {
    return `$${whole}`
  }
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '')
  return `$${whole}.${fracStr}`
}
