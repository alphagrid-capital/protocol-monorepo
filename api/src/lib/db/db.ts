import { AppError } from '../../errors.js'
import type { WorkerEnv, WorkerEnvWithDb } from '../../types/worker-env.js'

export function requireDb(env: WorkerEnv): D1Database {
  const db = (env as WorkerEnvWithDb).DB
  if (!db) {
    throw new AppError('Database not configured', 503, 'SERVICE_UNAVAILABLE')
  }
  return db
}
