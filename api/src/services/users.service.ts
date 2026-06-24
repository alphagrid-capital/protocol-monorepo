import { AppError } from '../errors.js'
import {
  isPreferredCurrency
  
} from '../constants/currencies.js'
import type {PreferredCurrency} from '../constants/currencies.js';
import { UsersRepository  } from '../db/users.repository.js'
import type {UserRow} from '../db/users.repository.js';
import { getWorkerEnv } from '../lib/worker-env.js'
import type { WorkerEnv } from '../types/worker-env.js'

export interface UserProfileSummary {
  displayName: string | null
  preferredCurrency: PreferredCurrency
  registeredAt: string
  lastLoginAt: string
}

export interface UserProfile extends UserProfileSummary {
  address: string
  updatedAt: string
}

function toPreferredCurrency(value: string): PreferredCurrency {
  return isPreferredCurrency(value) ? value : 'USD'
}

function toProfileSummary(row: UserRow): UserProfileSummary {
  return {
    displayName: row.display_name,
    preferredCurrency: toPreferredCurrency(row.preferred_currency),
    registeredAt: row.registered_at,
    lastLoginAt: row.last_login_at,
  }
}

function toProfile(row: UserRow): UserProfile {
  return {
    address: row.address,
    ...toProfileSummary(row),
    updatedAt: row.updated_at,
  }
}

export function toUserProfileSummary(profile: UserProfile): UserProfileSummary {
  const { address: _, updatedAt: __, ...summary } = profile
  return summary
}

export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  static fromEnv(env: WorkerEnv = getWorkerEnv()): UsersService {
    return new UsersService(new UsersRepository(env))
  }

  async upsertOnLogin(address: string, ip: string | null): Promise<UserProfile> {
    const row = await this.repository.upsertOnLogin(address, ip)
    return toProfile(row)
  }

  async getProfile(address: string): Promise<UserProfile> {
    const row = await this.repository.findByAddress(address)
    if (!row) {
      throw new AppError('User not found', 404, 'INVALID_REQUEST')
    }
    return toProfile(row)
  }

  async updateProfile(
    address: string,
    patch: { displayName?: string | null; preferredCurrency?: string }
  ): Promise<UserProfile> {
    if (
      patch.displayName === undefined &&
      patch.preferredCurrency === undefined
    ) {
      throw new AppError(
        'At least one of displayName or preferredCurrency is required',
        400,
        'INVALID_REQUEST'
      )
    }

    if (
      patch.preferredCurrency !== undefined &&
      !isPreferredCurrency(patch.preferredCurrency)
    ) {
      throw new AppError('Invalid preferredCurrency', 400, 'INVALID_REQUEST')
    }

    const row = await this.repository.updateProfile(address, patch)
    return toProfile(row)
  }
}
