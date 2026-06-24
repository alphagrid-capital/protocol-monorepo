import assert from 'node:assert/strict'
import test from 'node:test'
import type { StrategyContext, StrategyDecision } from './decision.ts'
import { assertStrategyDecisionGuardrails } from './guardrails.ts'

function baseContext(): StrategyContext {
  return {
    agentId: '1',
    strategy: 'Buy NVDA with guarded risk.',
    botFrequency: '1h',
    prices: {},
    positions: [],
    risk: {
      agentId: '1',
      trackId: 0,
      allocation: {
        cap: '1000000000',
        used: '0',
        available: '1000000000',
      },
      accountRiskBounds: {
        maxDailyLossBps: 500,
        maxDrawdownBps: 1000,
      },
      equity: {
        peakUsdc: '1000000000',
        currentUsdc: '1000000000',
        currentDrawdownBps: 0,
      },
      pnl: {
        lifetimeRealizedUsdc: '0',
        dailyRealizedUsdc: '0',
        day: '0',
      },
      positions: {
        opened: 0,
        closed: 0,
        openCount: 0,
      },
      breaches: {
        drawdown: false,
        dailyLoss: false,
      },
      derived: {
        returnBps: 0,
        unrealizedPnlUsdc: '0',
        drawdownUtilizationBps: 0,
        maxDailyLossUsdc: '50000000',
        dailyLossUsedUsdc: '0',
        dailyLossUtilizationBps: 0,
      },
      promotionReadiness: {
        minTradesRequired: 10,
        tradesCompleted: 0,
        meetsMinTrades: false,
        evaluationPeriodSeconds: '0',
        evaluationElapsedSeconds: '0',
        meetsEvaluationPeriod: false,
        promotionScoreRequired: 0,
        alphaScore: null,
        meetsAlphaScore: null,
        eligible: false,
        blockers: [],
      },
    },
    guardrails: {
      allowedSymbols: ['NVDA'],
      allocation: {
        cap: '1000000000',
        used: '0',
        available: '100000000',
      },
      exitBounds: {
        maxStopLossBps: 500,
        minTakeProfitBps: 100,
        maxTakeProfitBps: 1000,
        requireStopLoss: true,
        requireTakeProfit: true,
      },
      accountRiskBounds: {
        maxDailyLossBps: 500,
        maxDrawdownBps: 1000,
      },
      dailyRealizedPnlUsdc: '0',
      breaches: {
        drawdown: false,
        dailyLoss: false,
      },
      defaultExit: [
        { triggerType: 'StopLoss', triggerBps: 200, exitBps: 5000 },
        { triggerType: 'TakeProfit', triggerBps: 300, exitBps: 5000 },
      ],
      usdcDecimals: 6,
    },
  }
}

test('allows guarded open action', () => {
  const decision: StrategyDecision = {
    summary: 'Open NVDA',
    actions: [{ type: 'open', symbol: 'NVDA', usdcAmount: '50' }],
  }

  assert.doesNotThrow(() =>
    assertStrategyDecisionGuardrails(decision, baseContext())
  )
})

test('blocks open action for disallowed symbol', () => {
  const decision: StrategyDecision = {
    summary: 'Open TSLA',
    actions: [{ type: 'open', symbol: 'TSLA', usdcAmount: '50' }],
  }

  assert.throws(() => assertStrategyDecisionGuardrails(decision, baseContext()), {
    message: /Symbol is not allowed/,
  })
})

test('blocks open action above available allocation', () => {
  const decision: StrategyDecision = {
    summary: 'Open too large',
    actions: [{ type: 'open', symbol: 'NVDA', usdcAmount: '101' }],
  }

  assert.throws(() => assertStrategyDecisionGuardrails(decision, baseContext()), {
    message: /exceeds available allocation/,
  })
})

test('blocks open action during risk breach', () => {
  const context = baseContext()
  context.guardrails.breaches.dailyLoss = true
  const decision: StrategyDecision = {
    summary: 'Open while breached',
    actions: [{ type: 'open', symbol: 'NVDA', usdcAmount: '50' }],
  }

  assert.throws(() => assertStrategyDecisionGuardrails(decision, context), {
    message: /Risk breach active/,
  })
})

test('blocks close action for unknown position', () => {
  const decision: StrategyDecision = {
    summary: 'Close unknown',
    actions: [{ type: 'close', positionId: '1' }],
  }

  assert.throws(() => assertStrategyDecisionGuardrails(decision, baseContext()), {
    message: /not open or does not belong/,
  })
})
