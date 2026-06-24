import type { StrategyDecision } from '../../../schemas/strategy.js'
import type { StrategyContext } from '../decision.js'
import type { StrategyDecisionAdapter } from './types.js'

export const HOLD_DECISION_SUMMARY = 'Hold — no trades recommended.'

export const noneStrategyDecisionAdapter: StrategyDecisionAdapter = {
  async decide(_context: StrategyContext): Promise<StrategyDecision> {
    return {
      summary: HOLD_DECISION_SUMMARY,
      actions: [],
    }
  },
}
