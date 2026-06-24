import type { StrategyDecision } from '../../../schemas/strategy.js'
import type { StrategyContext } from '../decision.js'

export interface StrategyDecisionAdapter {
  decide(context: StrategyContext): Promise<StrategyDecision>
}
