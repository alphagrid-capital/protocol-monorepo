import type { WorkerEnv } from '../types/worker-env.js'

let activeEnv: WorkerEnv = {}

export function runWithWorkerEnv<T>(env: WorkerEnv, fn: () => T): T {
  const previous = activeEnv
  activeEnv = env
  try {
    return fn()
  } finally {
    activeEnv = previous
  }
}

export function getWorkerEnv(): WorkerEnv {
  return activeEnv
}
