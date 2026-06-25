import {
  StrategyAiEnvelopeSchema,
  type StrategyAdapterOutcome,
} from '../../../schemas/strategy-adapter.js'
import { extractJsonText } from './workers-ai.json.js'
import { mapEnvelopeToOutcome } from './workers-ai.outcome.js'

export {
  extractJsonText,
  readWorkersAiResponseText,
} from './workers-ai.json.js'
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
    const detail = envelopeResult.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ')
    return {
      status: 'error',
      code: 'INVALID_MODEL_OUTPUT',
      summary: 'Strategy decision failed — invalid model output.',
      message: `Model response did not match the required envelope schema. ${detail}`,
      actions: [],
    }
  }

  const envelope = envelopeResult.data
  return mapEnvelopeToOutcome(envelope)
}
