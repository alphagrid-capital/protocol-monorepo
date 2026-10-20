import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SignalsService,
  truthSocialCacheKey,
  type FredFetcher,
  type SignalsApifyFetcher,
  type SignalsCacheStore,
} from './load-signals.ts'
import type { SignalFeed } from './types.ts'

function mockCache(
  overrides: Partial<SignalsCacheStore> = {}
): SignalsCacheStore {
  return {
    get: async () => null,
    put: async () => undefined,
    ...overrides,
  }
}

function mockApify(
  overrides: Partial<SignalsApifyFetcher> = {}
): SignalsApifyFetcher {
  return {
    isConfigured: () => false,
    runTruthSocialScraper: async () => [],
    runEquityNewsScraper: async () => [],
    ...overrides,
  }
}

function mockFred(overrides: Partial<FredFetcher> = {}): FredFetcher {
  return {
    isConfigured: () => false,
    fetchLatest: async () => [],
    ...overrides,
  }
}

function service(
  env: Record<string, string | undefined> = {},
  cache: SignalsCacheStore = mockCache(),
  apify: SignalsApifyFetcher = mockApify(),
  fred: FredFetcher = mockFred()
) {
  return new SignalsService(env, cache, apify, fred)
}

test('truthSocialCacheKey lowercases username', () => {
  assert.equal(
    truthSocialCacheKey('RealDonaldTrump'),
    'truthsocial:realdonaldtrump'
  )
})

test('loadTruthSocial returns null when Apify is not configured and cache empty', async () => {
  assert.equal(await service().loadTruthSocial('realDonaldTrump'), null)
})

test('loadTruthSocial returns fresh cache without calling Apify', async () => {
  const fetchedAt = new Date().toISOString()
  const feed: SignalFeed = {
    source: 'truthsocial',
    handle: 'realDonaldTrump',
    fetchedAt,
    items: [{ id: '1', createdAt: fetchedAt, text: 'cached' }],
  }
  let apifyCalled = false
  const svc = service(
    { SIGNALS_CACHE_TTL_SECONDS: '3600' },
    mockCache({
      get: async () => ({
        payload_json: JSON.stringify(feed),
        fetched_at: feed.fetchedAt,
      }),
    }),
    mockApify({
      isConfigured: () => true,
      runTruthSocialScraper: async () => {
        apifyCalled = true
        return []
      },
    })
  )

  const result = await svc.loadTruthSocial('realDonaldTrump')
  assert.deepEqual(result, feed)
  assert.equal(apifyCalled, false)
})

test('loadTruthSocial soft-fails when Apify throws', async () => {
  const svc = service(
    {},
    mockCache(),
    mockApify({
      isConfigured: () => true,
      runTruthSocialScraper: async () => {
        throw new Error('blocked')
      },
    })
  )
  assert.equal(await svc.loadTruthSocial('realDonaldTrump'), null)
})

test('loadSignals returns feed for enabled Truth Social connection', async () => {
  const fetchedAt = new Date().toISOString()
  const feed: SignalFeed = {
    source: 'truthsocial',
    handle: 'someone',
    fetchedAt,
    items: [],
  }
  const svc = service(
    { SIGNALS_CACHE_TTL_SECONDS: '3600' },
    mockCache({
      get: async () => ({
        payload_json: JSON.stringify(feed),
        fetched_at: feed.fetchedAt,
      }),
    })
  )

  const feeds = await svc.loadSignals({
    truthsocial: { enabled: true, username: 'someone' },
  })
  assert.equal(feeds.length, 1)
  assert.equal(feeds[0]?.handle, 'someone')
})

test('loadSignals skips disabled Truth Social connection', async () => {
  const feeds = await service().loadSignals({
    truthsocial: { enabled: false, username: 'someone' },
  })
  assert.deepEqual(feeds, [])
})

test('loadSignals returns equity news using fallback symbols', async () => {
  const fetchedAt = new Date().toISOString()
  let calledWith: string[] | null = null
  const svc = service(
    {},
    mockCache(),
    mockApify({
      isConfigured: () => true,
      runEquityNewsScraper: async (symbols) => {
        calledWith = symbols
        return [
          {
            headline: 'NVDA rally',
            summary: 'AI chips',
            articleLink: 'https://example.com/1',
            publishedDate: fetchedAt,
            tickers: ['NVDA'],
          },
        ]
      },
    })
  )

  const feeds = await svc.loadSignals(
    { equitynews: { enabled: true } },
    { fallbackSymbols: ['nvda', 'AAPL'] }
  )
  assert.deepEqual(calledWith, ['NVDA', 'AAPL'])
  assert.equal(feeds.length, 1)
  assert.equal(feeds[0]?.source, 'equitynews')
  assert.equal(feeds[0]?.handle, 'NVDA,AAPL')
  assert.equal(feeds[0]?.items.length, 1)
  assert.match(feeds[0]?.items[0]?.text ?? '', /NVDA rally/)
})

test('loadSignals skips equity news when enabled but no symbols', async () => {
  let called = false
  const svc = service(
    {},
    mockCache(),
    mockApify({
      isConfigured: () => true,
      runEquityNewsScraper: async () => {
        called = true
        return []
      },
    })
  )
  const feeds = await svc.loadSignals({ equitynews: { enabled: true } })
  assert.deepEqual(feeds, [])
  assert.equal(called, false)
})

test('loadSignals returns FRED feed with default series when omitted', async () => {
  let calledWith: readonly string[] | null = null
  const svc = service(
    {},
    mockCache(),
    mockApify(),
    mockFred({
      isConfigured: () => true,
      fetchLatest: async (seriesIds) => {
        calledWith = seriesIds
        return [
          {
            seriesId: 'UNRATE',
            title: 'Unemployment Rate',
            date: '2026-09-01',
            value: '4.1',
            priorDate: '2026-08-01',
            priorValue: '4.2',
          },
        ]
      },
    })
  )

  const feeds = await svc.loadSignals({ fred: { enabled: true } })
  assert.ok(calledWith && calledWith.includes('UNRATE'))
  assert.equal(feeds.length, 1)
  assert.equal(feeds[0]?.source, 'fred')
  assert.match(feeds[0]?.items[0]?.text ?? '', /UNRATE/)
})
