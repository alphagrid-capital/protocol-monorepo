import type {
  StrategyAdapterOutcome,
  StrategyAiEnvelope,
} from '../../../schemas/strategy-adapter.js'

export function mapEnvelopeToOutcome(
  envelope: StrategyAiEnvelope
): StrategyAdapterOutcome {
  if (!envelope.safety.passed) {
    return {
      status: 'error',
      code: 'PROMPT_INJECTION',
      summary: 'Strategy rejected — possible prompt injection.',
      message:
        envelope.safety.reason || 'User strategy failed safety screening.',
      actions: [],
    }
  }

  if (!envelope.strategyAssessment.tradable) {
    return {
      status: 'error',
      code: 'NOT_TRADABLE_STRATEGY',
      summary: 'Strategy rejected — not a tradable strategy.',
      message:
        envelope.strategyAssessment.reason ||
        'User strategy does not describe actionable trading rules.',
      actions: [],
    }
  }

  if (!envelope.decision) {
    return {
      status: 'error',
      code: 'INVALID_MODEL_OUTPUT',
      summary: 'Strategy decision failed — invalid model output.',
      message: 'Strategy is tradable but decision was null.',
      actions: [],
    }
  }

  return {
    status: 'ok',
    summary: envelope.decision.summary,
    actions: envelope.decision.actions,
  }
}
