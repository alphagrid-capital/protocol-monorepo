import type { WorkerEnv } from '../types/worker-env.js'

let activeEnv: WorkerEnv = {}

export function runWithWorkerEnv<T>(
  env: WorkerEnv,
  fn: () => T | Promise<T>
): T | Promise<T> {
  const previous = activeEnv
  activeEnv = env
  try {
    const result = fn()
    if (result instanceof Promise) {
      return result.finally(() => {
        activeEnv = previous
      })
    }
    activeEnv = previous
    return result
  } catch (error) {
    activeEnv = previous
    throw error
  }
}

export function getWorkerEnv(): WorkerEnv {
  return activeEnv
}