import { AppError } from '../errors.js'
import { AgentRegistrationError } from '../services/agent-registration.service.js'
import { TradingError } from '../services/trading.service.js'

interface ToolTextContent {
  type: 'text'
  text: string
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function mcpToolSuccess<T>(data: T) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
      } satisfies ToolTextContent,
    ],
    structuredContent: data as Record<string, unknown>,
  }
}

export function mcpToolError(message: string, code = 'INTERNAL_SERVER_ERROR') {
  return {
    content: [
      { type: 'text', text: `${code}: ${message}` } satisfies ToolTextContent,
    ],
    isError: true as const,
  }
}

export function mcpToolErrorFromUnknown(
  error: unknown,
  fallbackMessage = 'Request failed'
) {
  if (error instanceof AppError || error instanceof AgentRegistrationError || error instanceof TradingError) {
    return mcpToolError(error.message, error.code)
  }
  const message = error instanceof Error ? error.message : fallbackMessage
  return mcpToolError(message)
}
