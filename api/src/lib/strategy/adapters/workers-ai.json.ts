export function extractJsonText(raw: string): string {
  const trimmed = raw.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed)
  if (fenced) {
    return fenced[1].trim()
  }
  return trimmed
}

function describeResponseShape(response: unknown): string {
  if (response === null || typeof response !== 'object') {
    return typeof response
  }
  const keys = Object.keys(response).join(', ')
  const preview = JSON.stringify(response).slice(0, 300)
  return `object{${keys}} ${preview}`
}

export function readWorkersAiResponseText(response: unknown): string {
  if (typeof response === 'string') {
    return response
  }
  if (response && typeof response === 'object' && 'response' in response) {
    const inner = (response).response
    if (typeof inner === 'string') {
      return inner
    }
    // JSON Mode (response_format) returns an already-parsed object here.
    if (inner && typeof inner === 'object') {
      return JSON.stringify(inner)
    }
  }
  throw new Error(
    `Unexpected Workers AI response shape: ${describeResponseShape(response)}`
  )
}
