export function parseAddress(value: string | undefined): `0x${string}` | null {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    return null
  }
  return value as `0x${string}`
}

export function parsePrivateKey(
  value: string | undefined
): `0x${string}` | null {
  if (!value) {
    return null
  }
  const normalized = value.startsWith('0x') ? value : `0x${value}`
  if (!/^0x[a-fA-F0-9]{64}$/.test(normalized)) {
    return null
  }
  return normalized as `0x${string}`
}
