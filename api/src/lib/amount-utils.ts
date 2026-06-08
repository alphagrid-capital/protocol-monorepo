/** Parse a human decimal amount (e.g. "25000" or "25000.5") into atomic units. */
export function parseHumanAmount(value: string, decimals: number): bigint {
  const trimmed = value.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid amount: ${value}`)
  }
  const [wholePart, fractionPart = ''] = trimmed.split('.')
  const fraction = fractionPart.padEnd(decimals, '0').slice(0, decimals)
  const whole = BigInt(wholePart)
  const frac = BigInt(fraction.padEnd(decimals, '0'))
  return whole * 10n ** BigInt(decimals) + frac
}
