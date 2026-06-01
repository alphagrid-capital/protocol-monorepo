/** Current MCP Streamable HTTP request (Workers handle one request per isolate at a time). */
let activeMcpRequest: Request | null = null;

export function runWithMcpRequest<T>(request: Request, fn: () => Promise<T>): Promise<T> {
  activeMcpRequest = request;
  return fn().finally(() => {
    activeMcpRequest = null;
  });
}

export function getActiveMcpRequest(): Request | null {
  return activeMcpRequest;
}
