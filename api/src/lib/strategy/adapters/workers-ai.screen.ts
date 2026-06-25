import type { StrategyAdapterOutcome } from '../../../schemas/strategy-adapter.js'

/** Matches `UpdateAgentDraftSchema` / managed agent `strategy.max(8192)`. */
export const MAX_STRATEGY_TEXT_LENGTH = 8192

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/i,
  /\bsystem\s+prompt\b/i,
  /\byou\s+are\s+now\b/i,
  /\bact\s+as\b/i,
  /\bdeveloper\s+mode\b/i,
  /\bjailbreak\b/i,
  /\boverride\s+(the\s+)?(schema|format|rules?|guardrails?)\b/i,
  /\breturn\s+(raw|unfiltered|secret)\b/i,
  /<\/?system>/i,
  /```/,
]

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
