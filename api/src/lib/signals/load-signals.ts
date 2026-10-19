import type { DataConnections } from '../../schemas/data-connections.js'
import type { WorkerEnv } from '../../types/worker-env.js'
import type { SignalFeed, SignalItem } from './types.js'

const DEFAULT_CACHE_TTL_SECONDS = 900
const DEFAULT_MAX_ITEMS = 10
const DEFAULT_MAX_TEXT_CHARS = 400

export interface SignalsCacheStore {
  get(
    cacheKey: string
  ): Promise<{ payload_json: string; fetched_at: string } | null>
  put(
    cacheKey: string,
    payloadJson: string,
    fetchedAt: string
  ): Promise<void>
}

export interface TruthSocialFetcher {
  isConfigured(): boolean
  runTruthSocialScraper(username: string): Promise<unknown[]>
}

export function truthSocialCacheKey(username: string): string {
  return `truthsocial:${username.toLowerCase()}`
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function pickString(
  record: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value)
    }
  }
  return undefined
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text
  }
  return `${text.slice(0, maxChars - 1)}…`
}

function hashText(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  }
  return hash.toString(16)
}

/** Map a raw Apify Truth Social dataset item to a slim signal item. */
export function normalizeTruthSocialItem(
  raw: unknown,
  maxTextChars = DEFAULT_MAX_TEXT_CHARS
): SignalItem | null {
  const record = asRecord(raw)
  if (!record) {
    return null
  }

  const text = pickString(record, [
    'content',
    'text',
    'cleanContent',
    'body',
    'message',
  ])
  if (!text) {
    return null
  }

  const id =
    pickString(record, ['id', 'postId', 'statusId', 'uri', 'url']) ??
    `truthsocial_${hashText(text)}`

  const createdAt =
    pickString(record, [
      'createdAt',
      'created_at',
      'publishedAt',
      'timestamp',
      'date',
    ]) ?? new Date(0).toISOString()

  return {
    id,
    createdAt,
    text: truncateText(text.trim(), maxTextChars),
  }
}

export function normalizeTruthSocialItems(
  items: unknown[],
  options: { maxItems?: number; maxTextChars?: number } = {}
): SignalItem[] {
  const maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS
  const maxTextChars = options.maxTextChars ?? DEFAULT_MAX_TEXT_CHARS
  const normalized: SignalItem[] = []

  for (const item of items) {
    const signal = normalizeTruthSocialItem(item, maxTextChars)
    if (!signal) {
      continue
    }
    normalized.push(signal)
    if (normalized.length >= maxItems) {
      break
    }
  }

  return normalized
}

function isFresh(fetchedAt: string, ttlSeconds: number, nowMs: number): boolean {
  const fetchedMs = Date.parse(fetchedAt)
  if (!Number.isFinite(fetchedMs)) {
    return false
  }
  return nowMs - fetchedMs < ttlSeconds * 1000
}

function parseCacheTtlSeconds(env: WorkerEnv): number {
  const raw = env.SIGNALS_CACHE_TTL_SECONDS
  if (!raw) {
    return DEFAULT_CACHE_TTL_SECONDS
  }
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_CACHE_TTL_SECONDS
  }
  return parsed
}

function parseMaxItems(env: WorkerEnv): number {
  const raw = env.APIFY_MAX_POSTS
  if (!raw) {
    return DEFAULT_MAX_ITEMS
  }
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_ITEMS
  }
  return Math.min(parsed, DEFAULT_MAX_ITEMS)
}

function parseFeed(payloadJson: string): SignalFeed | null {
  try {
    const parsed = JSON.parse(payloadJson) as SignalFeed
    if (
      typeof parsed?.source !== 'string' ||
      typeof parsed?.fetchedAt !== 'string' ||
      !Array.isArray(parsed.items)
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export class SignalsService {
  private readonly env: WorkerEnv
  private readonly cache: SignalsCacheStore
  private readonly apify: TruthSocialFetcher

  constructor(
    env: WorkerEnv,
    cache: SignalsCacheStore,
    apify: TruthSocialFetcher
  ) {
    this.env = env
    this.cache = cache
    this.apify = apify
  }

  /**
   * Load normalized signal feeds for enabled connections.
   * Soft-fails per provider (returns whatever succeeded).
   */
  async loadSignals(connections: DataConnections): Promise<SignalFeed[]> {
    const feeds: SignalFeed[] = []
    const truth = connections.truthsocial
    if (truth?.enabled && truth.username) {
      const feed = await this.loadTruthSocial(truth.username)
      if (feed) {
        feeds.push(feed)
      }
    }
    return feeds
  }

  /**
   * Prefetch Truth Social feeds for unique usernames (used by strategy tick).
   * Returns a map of lowercase username → feed (missing on failure).
   */
  async prefetchTruthSocial(
    usernames: string[]
  ): Promise<Map<string, SignalFeed>> {
    const unique = [
      ...new Set(
        usernames
          .map((name) => name.trim())
          .filter((name) => name.length > 0)
          .map((name) => name.toLowerCase())
      ),
    ]
    const results = await Promise.all(
      unique.map(async (username) => {
        const feed = await this.loadTruthSocial(username)
        return [username, feed] as const
      })
    )
    const map = new Map<string, SignalFeed>()
    for (const [username, feed] of results) {
      if (feed) {
        map.set(username, feed)
      }
    }
    return map
  }

  async loadTruthSocial(username: string): Promise<SignalFeed | null> {
    const normalizedUsername = username.replace(/^@+/, '').trim()
    if (!normalizedUsername) {
      return null
    }

    const cacheKey = truthSocialCacheKey(normalizedUsername)
    const ttlSeconds = parseCacheTtlSeconds(this.env)
    const nowMs = Date.now()

    try {
      const cached = await this.cache.get(cacheKey)
      if (cached && isFresh(cached.fetched_at, ttlSeconds, nowMs)) {
        return parseFeed(cached.payload_json)
      }
    } catch {
      // Cache read failures should not block a live Apify fetch.
    }

    if (!this.apify.isConfigured()) {
      return null
    }

    try {
      const rawItems = await this.apify.runTruthSocialScraper(normalizedUsername)
      const fetchedAt = new Date().toISOString()
      const feed: SignalFeed = {
        source: 'truthsocial',
        handle: normalizedUsername,
        fetchedAt,
        items: normalizeTruthSocialItems(rawItems, {
          maxItems: parseMaxItems(this.env),
        }),
      }
      try {
        await this.cache.put(cacheKey, JSON.stringify(feed), fetchedAt)
      } catch {
        // Persist failure is non-fatal; still return the feed for this run.
      }
      return feed
    } catch {
      return null
    }
  }
}
