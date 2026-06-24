import type { BotFrequency } from '../../schemas/agent-draft.js'

const ONE_HOUR_MS = 60 * 60 * 1000
const ONE_DAY_MS = 24 * ONE_HOUR_MS

export function computeNextRunAt(
  botFrequency: BotFrequency,
  fromMs = Date.now()
): string {
  const delayMs = botFrequency === '1d' ? ONE_DAY_MS : ONE_HOUR_MS
  return new Date(fromMs + delayMs).toISOString()
}
