/** Cloudflare Worker bindings / `wrangler.toml` vars (string values). */
export type WorkerEnv = Record<string, string | undefined>

/** Worker env including Durable Object bindings used by McpAgent. */
export type McpWorkerEnv = WorkerEnv & {
  MCP_OBJECT: DurableObjectNamespace
}

export type WorkerEnvWithDb = WorkerEnv & {
  DB?: D1Database
}
