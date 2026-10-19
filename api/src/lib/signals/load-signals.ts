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

export interface SignalsApifyFetcher {
  isConfigured(): boolean
  runTruthSocialScraper(username: string): Promise<unknown[]>
  runEquityNewsScraper(symbols: string[]): Promise<unknown[]>
}

export interface LoadSignalsOptions {
  /** Used when equitynews.enabled and symbols are omitted. */
  fallbackSymbols?: readonly string[]
  /** Prefetched Truth Social feeds keyed by lowercase username. */
  prefetchedTruthSocial?: Map<string, SignalFeed>
  /** Prefetched equity news feeds keyed by equityNewsCacheKey(symbols). */
  prefetchedEquityNews?: Map<string, SignalFeed>
}

export function truthSocialCacheKey(username: string): string {
  return `truthsocial:${username.toLowerCase()}`
}

/** Stable uppercase unique symbol list for cache keys / Apify input. */
export function normalizeEquityNewsSymbols(
  symbols: readonly string[] | undefined | null
): string[] {
  if (!symbols || symbols.length === 0) {
    return []
  }
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of symbols) {
    const symbol = String(raw).trim().toUpperCase()
    if (!symbol || seen.has(symbol)) {
      continue
    }
    if (!/^[A-Z0-9][A-Z0-9.\-]*$/.test(symbol)) {
      continue
    }
    seen.add(symbol)
    out.push(symbol)
    if (out.length >= 20) {
      break
    }
  }
  return out
}

export function equityNewsCacheKey(symbols: readonly string[]): string {
  return `equitynews:${[...normalizeEquityNewsSymbols(symbols)].sort().join(',')}`
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

/**
 * Map a raw Apify equity-news dataset row
 * (`vamsi-krishna~stock-market-news-collector`) to a slim signal item.
 */
export function normalizeEquityNewsItem(
  raw: unknown,
  maxTextChars = DEFAULT_MAX_TEXT_CHARS
): SignalItem | null {
  const record = asRecord(raw)
  if (!record) {
    return null
  }

  const headline = pickString(record, [
    'headline',
    'title',
    'text',
    'content',
  ])
  if (!headline) {
    return null
  }

  const summary = pickString(record, ['summary', 'description', 'snippet'])
  const tickersRaw = record.tickers
  const tickers = Array.isArray(tickersRaw)
    ? tickersRaw
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .map((t) => t.trim().toUpperCase())
        .slice(0, 5)
    : []
  const tickerPrefix = tickers.length > 0 ? `[${tickers.join(',')}] ` : ''
  const body = summary ? `${headline} — ${summary}` : headline
  const text = truncateText(`${tickerPrefix}${body}`.trim(), maxTextChars)

  const id =
    pickString(record, [
      'dedupeKey',
      'articleLink',
      'url',
      'link',
      'id',
    ]) ?? `equitynews_${hashText(text)}`

  const createdAt =
    pickString(record, [
      'publishedDate',
      'publishedAt',
      'fetchedAt',
      'createdAt',
      'timestamp',
      'date',
    ]) ?? new Date(0).toISOString()

  return { id, createdAt, text }
}

export function normalizeEquityNewsItems(
  items: unknown[],
  options: { maxItems?: number; maxTextChars?: number } = {}
): SignalItem[] {
  const maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS
  const maxTextChars = options.maxTextChars ?? DEFAULT_MAX_TEXT_CHARS
  const normalized: SignalItem[] = []
  const seen = new Set<string>()

  for (const item of items) {
    const signal = normalizeEquityNewsItem(item, maxTextChars)
    if (!signal || seen.has(signal.id)) {
      continue
    }
    seen.add(signal.id)
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

function parseEquityNewsMaxItems(env: WorkerEnv): number {
  const raw = env.APIFY_EQUITY_NEWS_MAX_ITEMS
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
  private readonly apify: SignalsApifyFetcher

  constructor(
    env: WorkerEnv,
    cache: SignalsCacheStore,
    apify: SignalsApifyFetcher
  ) {
    this.env = env
    this.cache = cache
    this.apify = apify
  }

  /**
   * Load normalized signal feeds for enabled connections.
   * Soft-fails per provider (returns whatever succeeded).
   */
  async loadSignals(
    connections: DataConnections,
    options: LoadSignalsOptions = {}
  ): Promise<SignalFeed[]> {
    const feeds: SignalFeed[] = []

    const truth = connections.truthsocial
    if (truth?.enabled && truth.username) {
      const key = truth.username.toLowerCase()
      const prefetched = options.prefetchedTruthSocial?.get(key)
      const feed = prefetched ?? (await this.loadTruthSocial(truth.username))
      if (feed) {
        feeds.push(feed)
      }
    }

    const equity = connections.equitynews
    if (equity?.enabled) {
      const symbols = normalizeEquityNewsSymbols(
        equity.symbols && equity.symbols.length > 0
          ? equity.symbols
          : options.fallbackSymbols
      )
      if (symbols.length > 0) {
        const cacheKey = equityNewsCacheKey(symbols)
        const prefetched = options.prefetchedEquityNews?.get(cacheKey)
        const feed = prefetched ?? (await this.loadEquityNews(symbols))
        if (feed) {
          feeds.push(feed)
        }
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

  /**
   * Prefetch equity news for unique symbol sets (used by strategy tick).
   * Keys are `equityNewsCacheKey(symbols)`.
   */
  async prefetchEquityNews(
    symbolSets: string[][]
  ): Promise<Map<string, SignalFeed>> {
    const uniqueKeys = new Map<string, string[]>()
    for (const set of symbolSets) {
      const symbols = normalizeEquityNewsSymbols(set)
      if (symbols.length === 0) {
        continue
      }
      uniqueKeys.set(equityNewsCacheKey(symbols), symbols)
    }

    const results = await Promise.all(
      [...uniqueKeys.entries()].map(async ([key, symbols]) => {
        const feed = await this.loadEquityNews(symbols)
        return [key, feed] as const
      })
    )
    const map = new Map<string, SignalFeed>()
    for (const [key, feed] of results) {
      if (feed) {
        map.set(key, feed)
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

  async loadEquityNews(symbols: string[]): Promise<SignalFeed | null> {
    const normalized = normalizeEquityNewsSymbols(symbols)
    if (normalized.length === 0) {
      return null
    }

    const cacheKey = equityNewsCacheKey(normalized)
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
      const rawItems = await this.apify.runEquityNewsScraper(normalized)
      const fetchedAt = new Date().toISOString()
      const feed: SignalFeed = {
        source: 'equitynews',
        handle: normalized.join(','),
        fetchedAt,
        items: normalizeEquityNewsItems(rawItems, {
          maxItems: parseEquityNewsMaxItems(this.env),
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
