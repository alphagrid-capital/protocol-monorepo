import type { BotFrequency } from '../../schemas/agent-draft.js'
import type { ListAgentPositionsResponse } from '../../schemas/trading.js'
import type { StrategyDecision } from '../../schemas/strategy.js'
import type { OraclePriceEntry } from '../../services/tokens.service.js'

export type { StrategyAction, StrategyDecision } from '../../schemas/strategy.js'

export interface StrategyContext {
  agentId: string
  strategy: string
  botFrequency: BotFrequency
  prices: Record<string, OraclePriceEntry>
  positions: ListAgentPositionsResponse['positions']
}

export async function decideStrategy(
  _context: StrategyContext
): Promise<StrategyDecision> {
  return {
    summary: 'Hold — no trades recommended.',
    actions: [],
  }
}
