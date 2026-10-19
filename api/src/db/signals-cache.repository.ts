import { requireDb } from '../lib/db/db.js'
import type { WorkerEnv } from '../types/worker-env.js'

export interface SignalsCacheRow {
  cache_key: string
  payload_json: string
  fetched_at: string
}

export class SignalsCacheRepository {
  constructor(private readonly env: WorkerEnv) {}

  async get(cacheKey: string): Promise<SignalsCacheRow | null> {
    const db = requireDb(this.env)
    return db
      .prepare(
        `SELECT cache_key, payload_json, fetched_at
         FROM signals_cache
         WHERE cache_key = ?`
      )
      .bind(cacheKey)
      .first<SignalsCacheRow>()
  }

  async put(
    cacheKey: string,
    payloadJson: string,
    fetchedAt: string
  ): Promise<void> {
    const db = requireDb(this.env)
    await db
      .prepare(
        `INSERT INTO signals_cache (cache_key, payload_json, fetched_at)
         VALUES (?, ?, ?)
         ON CONFLICT(cache_key) DO UPDATE SET
           payload_json = excluded.payload_json,
           fetched_at = excluded.fetched_at`
      )
      .bind(cacheKey, payloadJson, fetchedAt)
      .run()
  }
}
