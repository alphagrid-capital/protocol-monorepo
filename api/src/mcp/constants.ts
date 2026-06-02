export const MCP_SERVER_NAME = "alphagrid-mcp-server";
export const MCP_SERVER_VERSION = "0.2.0";

/** Single source of truth for MCP tool names (discovery + server registration). */
export const MCP_TOOL_NAMES = {
  listVaults: "alphagrid_list_vaults",
  getAgentRegistrationQuote: "alphagrid_get_agent_registration_quote",
  registerAgent: "alphagrid_register_agent",
} as const;

export const MCP_TOOL_NAME_LIST = Object.values(MCP_TOOL_NAMES);

export const READ_ONLY_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const WRITE_TOOL_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;
