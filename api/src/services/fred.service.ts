import type { FredSeriesSnapshot } from '../lib/signals/load-signals.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import type { WorkerEnv } from '../types/worker-env.js'

export type { FredSeriesSnapshot } from '../lib/signals/load-signals.js'
export { DEFAULT_FRED_SERIES_IDS } from '../lib/signals/load-signals.js'

const SERIES_TITLES: Record<string, string> = {
  UNRATE: 'Unemployment Rate',
  CPIAUCSL: 'CPI All Urban Consumers',
  DFF: 'Federal Funds Effective Rate',
  DGS10: '10-Year Treasury Yield',
  T10Y2Y: '10Y-2Y Treasury Spread',
  GDP: 'Gross Domestic Product',
  PAYEMS: 'Nonfarm Payrolls',
}

interface FredObservationsResponse {
  observations?: Array<{
    date?: string
    value?: string
  }>
}

export class FredService {
  private readonly env: WorkerEnv

  constructor(env: WorkerEnv) {
    this.env = env
  }

  static fromEnv(env: WorkerEnv = getWorkerEnv()): FredService {
    return new FredService(env)
  }

  isConfigured(): boolean {
    return Boolean(this.env.FRED_API_KEY?.trim())
  }

  /**
   * Latest (and prior) observation per series. Soft-fails per series:
   * missing/failed series are omitted from the result.
   */
  async fetchLatest(
    seriesIds: readonly string[]
  ): Promise<FredSeriesSnapshot[]> {
    const token = this.env.FRED_API_KEY?.trim()
    if (!token) {
      throw new Error('FRED_API_KEY is not configured')
    }
    if (seriesIds.length === 0) {
      return []
    }

    const results = await Promise.all(
      seriesIds.map((seriesId) => this.fetchOne(seriesId, token))
    )
    return results.filter((item): item is FredSeriesSnapshot => item !== null)
  }

  private async fetchOne(
    seriesId: string,
    apiKey: string
  ): Promise<FredSeriesSnapshot | null> {
    const url = new URL('https://api.stlouisfed.org/fred/series/observations')
    url.searchParams.set('series_id', seriesId)
    url.searchParams.set('api_key', apiKey)
    url.searchParams.set('file_type', 'json')
    url.searchParams.set('sort_order', 'desc')
    url.searchParams.set('limit', '2')

    const response = await fetch(url)
    if (!response.ok) {
      return null
    }

    const json = (await response.json()) as FredObservationsResponse
    const observations = Array.isArray(json.observations)
      ? json.observations
      : []
    const usable = observations.filter(
      (row) =>
        typeof row.date === 'string' &&
        typeof row.value === 'string' &&
        row.value !== '.' &&
        row.value.trim().length > 0
    )
    const latest = usable[0]
    if (!latest?.date || !latest.value) {
      return null
    }
    const prior = usable[1]

    return {
      seriesId,
      title: SERIES_TITLES[seriesId] ?? seriesId,
      date: latest.date,
      value: latest.value.trim(),
      ...(prior?.date && prior.value
        ? { priorDate: prior.date, priorValue: prior.value.trim() }
        : {}),
    }
  }
}
