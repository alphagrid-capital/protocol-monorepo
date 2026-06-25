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

  if (!envelope.decision) {
    return {
      status: 'error',
      code: 'INVALID_MODEL_OUTPUT',
      summary: 'Strategy decision failed — invalid model output.',
      message: 'Safety passed but decision was null.',
      actions: [],
    }
  }

  return {
    status: 'ok',
    summary: envelope.decision.summary,
    actions: envelope.decision.actions,
  }
}
