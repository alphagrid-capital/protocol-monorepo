import type { StrategyAdapterOutcome } from '../../../schemas/strategy-adapter.js'

/** Matches `UpdateAgentDraftSchema` / managed agent `strategy.max(8192)`. */
export const MAX_STRATEGY_TEXT_LENGTH = 8192

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/i,
  /\bsystem\s+prompt\b/i,
  /\bdeveloper\s+mode\b/i,
  /\bjailbreak\b/i,
  /\boverride\s+(the\s+)?(schema|format|rules?|guardrails?)\b/i,
  /\breturn\s+(raw|unfiltered|secret)\b/i,
  /<\/?system>/i,
  /```/,
]

const NON_TRADABLE_PATTERNS: RegExp[] = [
  /\bsend\s+(me\s+)?(all\s+)?(the\s+)?(money|funds|cash|usdc|crypto|wallet)\b/i,
  /\btransfer\s+(all\s+)?(the\s+)?(money|funds|cash|usdc|crypto)\b/i,
  /\bgive\s+me\s+(all\s+)?(your\s+)?(money|funds|cash|usdc)\b/i,
  /\b(pay|wire|send)\s+me\b/i,
  /\b(drain|empty|steal)\s+(the\s+)?(wallet|account|funds)\b/i,
  /\bwhat\s+is\s+.+\?/i,
  /\bwho\s+are\s+you\b/i,
  /\bbe\s+a(n?\s+)?helpful\b/i,
  /^hello\b/i,
]

const TRADING_SIGNAL_PATTERN =
  /\b(buy|sell|long|short|open|close|add|reduce|hold|entry|exit|position|stop[\s-]?loss|take[\s-]?profit|pullback|dip|rally|breakout|allocate|allocation|symbol|token|usdc|\d+\s*%|\d+\s*bps)\b/i

function mentionsAllowedSymbol(
  strategy: string,
  allowedSymbols: readonly string[]
): boolean {
  const upper = strategy.toUpperCase()
  return allowedSymbols.some((symbol) =>
    upper.includes(symbol.trim().toUpperCase())
  )
}

function notTradableOutcome(message: string): StrategyAdapterOutcome {
  return {
    status: 'error',
    code: 'NOT_TRADABLE_STRATEGY',
    summary: 'Strategy rejected — not a tradable strategy.',
    message,
    actions: [],
  }
}

export function screenUserStrategy(strategy: string): StrategyAdapterOutcome | null {
  if (strategy.length > MAX_STRATEGY_TEXT_LENGTH) {
    return {
      status: 'error',
      code: 'STRATEGY_TOO_LONG',
      summary: 'Strategy rejected — text too long.',
      message: `User strategy exceeds max length of ${MAX_STRATEGY_TEXT_LENGTH} characters.`,
      actions: [],
    }
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(strategy)) {
      return {
        status: 'error',
        code: 'PROMPT_INJECTION',
        summary: 'Strategy rejected — possible prompt injection.',
        message: 'User strategy contains disallowed override instructions.',
        actions: [],
      }
    }
  }

  return null
}

export function assessStrategyTradability(
  strategy: string,
  allowedSymbols: readonly string[] = []
): StrategyAdapterOutcome | null {
  const trimmed = strategy.trim()
  if (!trimmed) {
    return notTradableOutcome('Strategy text is empty.')
  }

  for (const pattern of NON_TRADABLE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return notTradableOutcome(
        'Strategy looks like a command or chat message, not trading rules.'
      )
    }
  }

  const hasTradingSignal =
    TRADING_SIGNAL_PATTERN.test(trimmed) ||
    mentionsAllowedSymbol(trimmed, allowedSymbols)

  if (!hasTradingSignal) {
    return notTradableOutcome(
      'Strategy does not describe what to buy/sell, when to enter/exit, or which symbols to trade.'
    )
  }

  return null
}
