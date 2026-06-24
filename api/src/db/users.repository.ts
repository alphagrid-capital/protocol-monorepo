import { AppError } from '../errors.js'
import { requireDb } from '../lib/db/db.js'
import { normalizeAddress } from '../lib/evm/utils.js'
import type { WorkerEnv } from '../types/worker-env.js'

export interface UserRow {
  address: string
  display_name: string | null
  preferred_currency: string
  registered_at: string
  registered_ip: string | null
  last_login_at: string
  last_login_ip: string | null
  updated_at: string
}

export class UsersRepository {
  constructor(private readonly env: WorkerEnv) {}

  async findByAddress(address: string): Promise<UserRow | null> {
    const db = requireDb(this.env)
    return db
      .prepare('SELECT * FROM users WHERE address = ?')
      .bind(normalizeAddress(address))
      .first<UserRow>()
  }

  async upsertOnLogin(address: string, ip: string | null): Promise<UserRow> {
    const db = requireDb(this.env)
    const normalizedAddress = normalizeAddress(address)
    const now = new Date().toISOString()

    const row = await db
      .prepare(
        `INSERT INTO users (
           address, display_name, preferred_currency,
           registered_at, registered_ip, last_login_at, last_login_ip, updated_at
         ) VALUES (?, NULL, 'USD', ?, ?, ?, ?, ?)
         ON CONFLICT(address) DO UPDATE SET
           last_login_at = excluded.last_login_at,
           last_login_ip = excluded.last_login_ip,
           updated_at = excluded.updated_at
         RETURNING *`
      )
      .bind(normalizedAddress, now, ip, now, ip, now)
      .first<UserRow>()

    if (!row) {
      throw new AppError(
        'Failed to upsert user row',
        503,
        'SERVICE_UNAVAILABLE'
      )
    }
    return row
  }

  async updateProfile(
    address: string,
    patch: { displayName?: string | null; preferredCurrency?: string }
  ): Promise<UserRow> {
    const db = requireDb(this.env)
    const normalizedAddress = normalizeAddress(address)
    const existing = await this.findByAddress(normalizedAddress)
    if (!existing) {
      throw new AppError('User not found', 404, 'INVALID_REQUEST')
    }

    const displayName =
      patch.displayName === undefined
        ? existing.display_name
        : patch.displayName
    const preferredCurrency =
      patch.preferredCurrency ?? existing.preferred_currency
    const now = new Date().toISOString()

    const updated = await db
      .prepare(
        `UPDATE users
         SET display_name = ?, preferred_currency = ?, updated_at = ?
         WHERE address = ?
         RETURNING *`
      )
      .bind(displayName, preferredCurrency, now, normalizedAddress)
      .first<UserRow>()

    if (!updated) {
      throw new AppError(
        'Failed to update user row',
        503,
        'SERVICE_UNAVAILABLE'
      )
    }
    return updated
  }
}
