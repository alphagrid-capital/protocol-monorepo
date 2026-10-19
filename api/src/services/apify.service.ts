import { getWorkerEnv } from '../lib/worker-env.js'
import type { WorkerEnv } from '../types/worker-env.js'

const DEFAULT_TRUTH_ACTOR_ID = 'muhammetakkurtt~truth-social-scraper'
const DEFAULT_EQUITY_NEWS_ACTOR_ID =
  'vamsi-krishna~stock-market-news-collector'
const DEFAULT_WAIT_FOR_FINISH_SECONDS = 120
const DEFAULT_MAX_POSTS = 20
const DEFAULT_EQUITY_NEWS_MAX_ITEMS = 20
const DEFAULT_EQUITY_NEWS_HOURS_BACK = 48

interface ApifyRunData {
  id?: string
  status?: string
  defaultDatasetId?: string
}

interface ApifyRunResponse {
  data?: ApifyRunData
}

export class ApifyService {
  private readonly env: WorkerEnv

  constructor(env: WorkerEnv) {
    this.env = env
  }

  static fromEnv(env: WorkerEnv = getWorkerEnv()): ApifyService {
    return new ApifyService(env)
  }

  isConfigured(): boolean {
    return Boolean(this.env.APIFY_TOKEN?.trim())
  }

  async runTruthSocialScraper(username: string): Promise<unknown[]> {
    const token = this.requireToken()
    const actorId =
      this.env.APIFY_TRUTH_ACTOR_ID?.trim() || DEFAULT_TRUTH_ACTOR_ID
    const maxPosts = parsePositiveInt(
      this.env.APIFY_MAX_POSTS,
      DEFAULT_MAX_POSTS
    )

    return this.runActorAndFetchItems(
      token,
      actorId,
      {
        username,
        maxPosts,
        cleanContent: true,
        onlyMedia: false,
        onlyReplies: false,
        useLastPostId: false,
      },
      maxPosts
    )
  }

  /**
   * Fetch recent equity / company news for tickers via Apify
   * (`vamsi-krishna~stock-market-news-collector` by default).
   */
  async runEquityNewsScraper(symbols: string[]): Promise<unknown[]> {
    const token = this.requireToken()
    if (symbols.length === 0) {
      return []
    }

    const actorId =
      this.env.APIFY_EQUITY_NEWS_ACTOR_ID?.trim() ||
      DEFAULT_EQUITY_NEWS_ACTOR_ID
    const maxItems = parsePositiveInt(
      this.env.APIFY_EQUITY_NEWS_MAX_ITEMS,
      DEFAULT_EQUITY_NEWS_MAX_ITEMS
    )
    const hoursBack = parsePositiveInt(
      this.env.APIFY_EQUITY_NEWS_HOURS_BACK,
      DEFAULT_EQUITY_NEWS_HOURS_BACK
    )

    return this.runActorAndFetchItems(
      token,
      actorId,
      {
        tickers: symbols,
        feedPreset: 'us_markets',
        onlyNewArticles: false,
        hoursBack,
        maxItems,
        includeFullText: false,
        deduplicate: true,
        useTickerFeeds: true,
      },
      maxItems
    )
  }

  private requireToken(): string {
    const token = this.env.APIFY_TOKEN?.trim()
    if (!token) {
      throw new Error('APIFY_TOKEN is not configured')
    }
    return token
  }

  private async runActorAndFetchItems(
    token: string,
    actorId: string,
    input: Record<string, unknown>,
    itemLimit: number
  ): Promise<unknown[]> {
    const waitForFinish = parsePositiveInt(
      this.env.APIFY_WAIT_FOR_FINISH_SECONDS,
      DEFAULT_WAIT_FOR_FINISH_SECONDS
    )

    const runUrl = new URL(
      `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs`
    )
    runUrl.searchParams.set('waitForFinish', String(waitForFinish))

    const runResponse = await fetch(runUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })

    if (!runResponse.ok) {
      const body = await runResponse.text()
      throw new Error(
        `Apify run failed (${runResponse.status}): ${body.slice(0, 300)}`
      )
    }

    const runJson = (await runResponse.json()) as ApifyRunResponse
    const datasetId = runJson.data?.defaultDatasetId
    const status = runJson.data?.status
    if (!datasetId) {
      throw new Error('Apify run response missing defaultDatasetId')
    }
    if (status && status !== 'SUCCEEDED') {
      throw new Error(`Apify run did not succeed (status=${status})`)
    }

    return this.fetchDatasetItems(datasetId, token, itemLimit)
  }

  private async fetchDatasetItems(
    datasetId: string,
    token: string,
    limit: number
  ): Promise<unknown[]> {
    const itemsUrl = new URL(
      `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items`
    )
    itemsUrl.searchParams.set('limit', String(limit))
    itemsUrl.searchParams.set('clean', 'true')

    const response = await fetch(itemsUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(
        `Apify dataset fetch failed (${response.status}): ${body.slice(0, 300)}`
      )
    }

    const items = (await response.json()) as unknown
    return Array.isArray(items) ? items : []
  }
}

function parsePositiveInt(
  raw: string | undefined,
  fallback: number
): number {
  if (!raw) {
    return fallback
  }
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}
