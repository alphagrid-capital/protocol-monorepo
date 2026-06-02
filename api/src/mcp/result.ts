import { AppError } from "../errors.js";
import { AgentRegistrationError } from "../services/agent-registration.service.js";

type ToolTextContent = { type: "text"; text: string };

export function mcpToolSuccess<T>(data: T) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) } satisfies ToolTextContent],
    structuredContent: data as Record<string, unknown>,
  };
}

export function mcpToolError(message: string, code = "INTERNAL_SERVER_ERROR") {
  return {
    content: [{ type: "text", text: `${code}: ${message}` } satisfies ToolTextContent],
    isError: true as const,
  };
}

export function mcpToolErrorFromUnknown(error: unknown, fallbackMessage = "Request failed") {
  if (error instanceof AppError || error instanceof AgentRegistrationError) {
    return mcpToolError(error.message, error.code);
  }
  const message = error instanceof Error ? error.message : fallbackMessage;
  return mcpToolError(message);
}
