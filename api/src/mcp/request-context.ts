/** Current MCP Streamable HTTP request (Workers handle one request per isolate at a time). */
let activeMcpRequest: Request | null = null

export function runWithMcpRequest<T>(
  request: Request,
  fn: () => Promise<T>
): Promise<T> {
  activeMcpRequest = request
  // Do not clear in finally: MCP tool handlers may run after transport returns (SSE).
  return fn()
}

export function getActiveMcpRequest(): Request | null {
  return activeMcpRequest
}
