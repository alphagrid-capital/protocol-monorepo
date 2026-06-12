/** Account return vs allocation cap in bps; null when cap is zero. */
export function accountReturnBps(
  cap: bigint,
  currentEquity: bigint
): number | null {
  if (cap === 0n) {
    return null
  }
  return Number(((currentEquity - cap) * 10000n) / cap)
}

/** Ratio of current to limit in bps; null when limit is zero. */
export function utilizationBps(current: number, limit: number): number | null {
  if (limit === 0) {
    return null
  }
  return Math.floor((current * 10000) / limit)
}

/** Policy max daily loss in USDC base units (positive magnitude). */
export function maxDailyLossUsdc(
  cap: bigint,
  maxDailyLossBps: number
): bigint {
  return (cap * BigInt(maxDailyLossBps)) / 10000n
}

/** Loss consumed today in USDC base units (non-negative). */
export function dailyLossUsedUsdc(dailyRealized: bigint): bigint {
  return dailyRealized < 0n ? -dailyRealized : 0n
}

/** Account-level unrealized PnL from equity identity. */
export function accountUnrealizedUsdc(
  cap: bigint,
  lifetimeRealized: bigint,
  currentEquity: bigint
): bigint {
  return currentEquity - cap - lifetimeRealized
}

/** Position return vs cost basis in bps; null when cost basis is zero. */
export function positionReturnBps(
  costBasis: bigint,
  pnlUsdc: bigint
): number | null {
  if (costBasis === 0n) {
    return null
  }
  return Number((pnlUsdc * 10000n) / costBasis)
}

export function positionTotalPnlUsdc(
  isOpen: boolean,
  unrealizedPnlUsdc?: bigint,
  realizedPnlUsdc?: bigint
): bigint {
  if (isOpen) {
    return unrealizedPnlUsdc ?? 0n
  }
  return realizedPnlUsdc ?? 0n
}

export function utilizationBpsFromBigint(
  current: bigint,
  limit: bigint
): number | null {
  if (limit === 0n) {
    return null
  }
  return Number((current * 10000n) / limit)
}

export type PromotionReadinessResult = {
  minTradesRequired: number
  tradesCompleted: number
  meetsMinTrades: boolean
  evaluationPeriodSeconds: string
  evaluationElapsedSeconds: string
  meetsEvaluationPeriod: boolean
  promotionScoreRequired: number
  alphaScore: null
  meetsAlphaScore: null
  eligible: boolean
  blockers: string[]
}

export function buildPromotionReadiness(params: {
  minTrades: number
  positionsClosed: number
  evaluationPeriodSeconds: bigint
  createdAtSeconds: bigint
  nowSeconds: bigint
  promotionScoreRequired: number
  drawdownBreached: boolean
  dailyLossBreached: boolean
  agentStatus: number
  agentStatusActive: number
}): PromotionReadinessResult {
  const elapsed =
    params.nowSeconds > params.createdAtSeconds
      ? params.nowSeconds - params.createdAtSeconds
      : 0n
  const meetsMinTrades = params.positionsClosed >= params.minTrades
  const meetsEvaluationPeriod = elapsed >= params.evaluationPeriodSeconds

  const blockers: string[] = ['alpha_score_unavailable']
  if (!meetsMinTrades) {
    blockers.push('min_trades_not_met')
  }
  if (!meetsEvaluationPeriod) {
    blockers.push('evaluation_period_not_met')
  }
  if (params.drawdownBreached) {
    blockers.push('drawdown_breached')
  }
  if (params.dailyLossBreached) {
    blockers.push('daily_loss_breached')
  }
  if (params.agentStatus !== params.agentStatusActive) {
    blockers.push('agent_not_active')
  }

  const eligible =
    meetsMinTrades &&
    meetsEvaluationPeriod &&
    !params.drawdownBreached &&
    !params.dailyLossBreached &&
    params.agentStatus === params.agentStatusActive &&
    false

  return {
    minTradesRequired: params.minTrades,
    tradesCompleted: params.positionsClosed,
    meetsMinTrades,
    evaluationPeriodSeconds: params.evaluationPeriodSeconds.toString(),
    evaluationElapsedSeconds: elapsed.toString(),
    meetsEvaluationPeriod,
    promotionScoreRequired: params.promotionScoreRequired,
    alphaScore: null,
    meetsAlphaScore: null,
    eligible,
    blockers,
  }
}
