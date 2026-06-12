import {
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
  type Hex,
} from 'viem'

export type ExitInput = {
  triggerType: 'StopLoss' | 'TakeProfit'
  triggerBps: number
  exitBps: number
}

function mapTriggerType(triggerType: ExitInput['triggerType']): 0 | 1 {
  return triggerType === 'StopLoss' ? 0 : 1
}

export function hashExitRules(exits: ExitInput[]): Hex {
  const ruleHashes = exits.map((rule) =>
    keccak256(
      encodeAbiParameters(parseAbiParameters('uint8, int256, uint16'), [
        mapTriggerType(rule.triggerType),
        BigInt(rule.triggerBps),
        rule.exitBps,
      ])
    )
  )
  return keccak256(
    encodeAbiParameters(parseAbiParameters('bytes32[]'), [ruleHashes])
  )
}

export function parseHumanUsdcAmount(value: string): bigint {
  const trimmed = value.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid USDC amount: ${value}`)
  }
  const [wholePart, fractionPart = ''] = trimmed.split('.')
  const decimals = 6
  const fraction = fractionPart.padEnd(decimals, '0').slice(0, decimals)
  const whole = BigInt(wholePart)
  const frac = BigInt(fraction.padEnd(decimals, '0'))
  return whole * 10n ** BigInt(decimals) + frac
}
