import type { WorkerEnv } from '../types/worker-env.js'

let activeEnv: WorkerEnv = {}

export function runWithWorkerEnv<T>(
  env: WorkerEnv,
  fn: () => T | Promise<T>
): T | Promise<T> {
  activeEnv = env
  // Do not restore in finally: MCP tool handlers may run after the transport returns.
  return fn()
}

export function getWorkerEnv(): WorkerEnv {
  return activeEnv
}
