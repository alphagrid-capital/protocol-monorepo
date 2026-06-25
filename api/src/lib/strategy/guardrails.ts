import type { ExitRuleInput } from '../../schemas/trading.js'
import type { StrategyContext, StrategyDecision } from './decision.js'

function fail(message: string): never {
  throw new Error(message)
}

function parseUsdcAmount(value: string, decimals: number): bigint {
  const [whole, fraction = ''] = value.split('.')
  if (!whole || fraction.length > decimals) {
    fail(`Invalid USDC amount: ${value}`)
  }
  const paddedFraction = fraction.padEnd(decimals, '0')
  return BigInt(`${whole}${paddedFraction}`)
}

function assertAmountWithinAvailable(
  actionLabel: string,
  usdcAmount: string,
  context: StrategyContext
): void {
  const amount = parseUsdcAmount(usdcAmount, context.guardrails.usdcDecimals)
  const available = BigInt(context.guardrails.allocation.available)
  if (amount <= 0n) {
    fail(`${actionLabel} amount must be greater than zero`)
  }
  if (amount > available) {
    fail(
      `${actionLabel} amount exceeds available allocation: ${usdcAmount} > ${context.guardrails.allocation.available}`
    )
  }
}

function assertExitRules(
  rules: ExitRuleInput[],
  context: StrategyContext
): void {
  const { exitBounds } = context.guardrails
  const hasStopLoss = rules.some((rule) => rule.triggerType === 'StopLoss')
  const hasTakeProfit = rules.some((rule) => rule.triggerType === 'TakeProfit')

  if (exitBounds.requireStopLoss && !hasStopLoss) {
    fail('Open action requires a stop-loss exit rule')
  }
  if (exitBounds.requireTakeProfit && !hasTakeProfit) {
    fail('Open action requires a take-profit exit rule')
  }

  for (const rule of rules) {
    if (rule.triggerBps <= 0) {
      fail('Exit rule triggerBps must be greater than zero')
    }
    if (
      rule.triggerType === 'StopLoss' &&
      rule.triggerBps > exitBounds.maxStopLossBps
    ) {
      fail(
        `Stop-loss trigger exceeds maxStopLossBps: ${rule.triggerBps} > ${exitBounds.maxStopLossBps}`
      )
    }
    if (
      rule.triggerType === 'TakeProfit' &&
      rule.triggerBps < exitBounds.minTakeProfitBps
    ) {
      fail(
        `Take-profit trigger is below minTakeProfitBps: ${rule.triggerBps} < ${exitBounds.minTakeProfitBps}`
      )
    }
    if (
      rule.triggerType === 'TakeProfit' &&
      rule.triggerBps > exitBounds.maxTakeProfitBps
    ) {
      fail(
        `Take-profit trigger exceeds maxTakeProfitBps: ${rule.triggerBps} > ${exitBounds.maxTakeProfitBps}`
      )
    }
  }
}

function assertOpenPosition(
  positionId: string,
  context: StrategyContext
): void {
  const exists = context.positions.some(
    (position) =>
      position.positionId === positionId && position.status === 'Open'
  )
  if (!exists) {
    fail(`Position ${positionId} is not open or does not belong to this agent`)
  }
}

export function assertStrategyDecisionGuardrails(
  decision: StrategyDecision,
  context: StrategyContext
): void {
  for (const action of decision.actions) {
    if (
      (context.guardrails.breaches.drawdown ||
        context.guardrails.breaches.dailyLoss) &&
      (action.type === 'open' || action.type === 'add')
    ) {
      fail(`Risk breach active; ${action.type} actions are disabled`)
    }

    switch (action.type) {
      case 'open': {
        if (!context.guardrails.allowedSymbols.includes(action.symbol)) {
          fail(`Symbol is not allowed for this vault: ${action.symbol}`)
        }
        const duplicate = context.positions.some(
          (position) =>
            position.status === 'Open' && position.symbol === action.symbol
        )
        if (duplicate) {
          fail(`Agent already has an open ${action.symbol} position`)
        }
        assertAmountWithinAvailable('Open', action.usdcAmount, context)
        if (action.exits) {
          assertExitRules(action.exits, context)
        }
        break
      }
      case 'add':
        assertOpenPosition(action.positionId, context)
        assertAmountWithinAvailable('Add', action.usdcAmount, context)
        break
      case 'reduce':
      case 'close':
        assertOpenPosition(action.positionId, context)
        break
      default: {
        const _exhaustive: never = action
        fail(`Unsupported action type: ${String(_exhaustive)}`)
      }
    }
  }
}
