import {
  StrategyAiEnvelopeSchema,
  type StrategyAdapterOutcome,
} from '../../../schemas/strategy-adapter.js'
import { extractJsonText } from './workers-ai.json.js'
import { mapEnvelopeToOutcome } from './workers-ai.outcome.js'

export { extractJsonText } from './workers-ai.json.js'
export { mapEnvelopeToOutcome } from './workers-ai.outcome.js'

export function parseWorkersAiResponse(raw: string): StrategyAdapterOutcome {
  let parsed: unknown
  try {
    parsed = JSON.parse(extractJsonText(raw))
  } catch {
    return {
      status: 'error',
      code: 'INVALID_MODEL_OUTPUT',
      summary: 'Strategy decision failed — invalid model output.',
      message: 'Model response was not valid JSON.',
      actions: [],
    }
  }

  const envelopeResult = StrategyAiEnvelopeSchema.safeParse(parsed)
  if (!envelopeResult.success) {
    return {
      status: 'error',
      code: 'INVALID_MODEL_OUTPUT',
      summary: 'Strategy decision failed — invalid model output.',
      message: 'Model response did not match the required envelope schema.',
      actions: [],
    }
  }

  const envelope = envelopeResult.data
  return mapEnvelopeToOutcome(envelope)
}

export function readWorkersAiResponseText(response: unknown): string {
  if (typeof response === 'string') {
    return response
  }
  if (
    response &&
    typeof response === 'object' &&
    'response' in response &&
    typeof response.response === 'string'
  ) {
    return response.response
  }
  throw new Error('Unexpected Workers AI response shape')
}
