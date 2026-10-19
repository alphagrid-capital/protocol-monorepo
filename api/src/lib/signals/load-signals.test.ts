import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SignalsService,
  truthSocialCacheKey,
  type SignalsCacheStore,
  type TruthSocialFetcher,
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
  overrides: Partial<TruthSocialFetcher> = {}
): TruthSocialFetcher {
  return {
    isConfigured: () => false,
    runTruthSocialScraper: async () => [],
    ...overrides,
  }
}

test('truthSocialCacheKey lowercases username', () => {
  assert.equal(
    truthSocialCacheKey('RealDonaldTrump'),
    'truthsocial:realdonaldtrump'
  )
})

test('loadTruthSocial returns null when Apify is not configured and cache empty', async () => {
  const service = new SignalsService({}, mockCache(), mockApify())
  assert.equal(await service.loadTruthSocial('realDonaldTrump'), null)
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
  const service = new SignalsService(
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

  const result = await service.loadTruthSocial('realDonaldTrump')
  assert.deepEqual(result, feed)
  assert.equal(apifyCalled, false)
})

test('loadTruthSocial soft-fails when Apify throws', async () => {
  const service = new SignalsService(
    {},
    mockCache(),
    mockApify({
      isConfigured: () => true,
      runTruthSocialScraper: async () => {
        throw new Error('blocked')
      },
    })
  )
  assert.equal(await service.loadTruthSocial('realDonaldTrump'), null)
})

test('loadSignals returns feed for enabled Truth Social connection', async () => {
  const fetchedAt = new Date().toISOString()
  const feed: SignalFeed = {
    source: 'truthsocial',
    handle: 'someone',
    fetchedAt,
    items: [],
  }
  const service = new SignalsService(
    { SIGNALS_CACHE_TTL_SECONDS: '3600' },
    mockCache({
      get: async () => ({
        payload_json: JSON.stringify(feed),
        fetched_at: feed.fetchedAt,
      }),
    }),
    mockApify()
  )

  const feeds = await service.loadSignals({
    truthsocial: { enabled: true, username: 'someone' },
  })
  assert.equal(feeds.length, 1)
  assert.equal(feeds[0]?.handle, 'someone')
})

test('loadSignals skips disabled Truth Social connection', async () => {
  const service = new SignalsService({}, mockCache(), mockApify())
  const feeds = await service.loadSignals({
    truthsocial: { enabled: false, username: 'someone' },
  })
  assert.deepEqual(feeds, [])
})
