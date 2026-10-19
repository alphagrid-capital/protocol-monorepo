import { getWorkerEnv } from '../lib/worker-env.js'
import type { WorkerEnv } from '../types/worker-env.js'

const DEFAULT_ACTOR_ID = 'muhammetakkurtt~truth-social-scraper'
const DEFAULT_WAIT_FOR_FINISH_SECONDS = 120
const DEFAULT_MAX_POSTS = 20

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
    const token = this.env.APIFY_TOKEN?.trim()
    if (!token) {
      throw new Error('APIFY_TOKEN is not configured')
    }

    const actorId =
      this.env.APIFY_TRUTH_ACTOR_ID?.trim() || DEFAULT_ACTOR_ID
    const maxPosts = parsePositiveInt(
      this.env.APIFY_MAX_POSTS,
      DEFAULT_MAX_POSTS
    )
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
      body: JSON.stringify({
        username,
        maxPosts,
        cleanContent: true,
        onlyMedia: false,
        onlyReplies: false,
        useLastPostId: false,
      }),
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

    return this.fetchDatasetItems(datasetId, token, maxPosts)
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
