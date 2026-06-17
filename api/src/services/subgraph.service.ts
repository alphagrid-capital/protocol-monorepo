import { AppError } from '../errors.js'
import {
  AGENT_ACTIVITIES_QUERY,
  CLOSED_POSITIONS_QUERY,
} from '../lib/subgraph-queries.js'
import type {
  SubgraphActivitiesResult,
  SubgraphClosedPositionsResult,
} from '../lib/subgraph-mappers.js'
import { getWorkerEnv } from '../lib/worker-env.js'

export class SubgraphError extends AppError {
  constructor(
    message: string,
    readonly status = 502
  ) {
    super(message, status)
    this.name = 'SubgraphError'
  }
}

type GraphqlResponse<T> = {
  data?: T
  errors?: { message: string }[]
}

export class SubgraphService {
  constructor(private readonly subgraphUrl: string) {}

  static fromEnv(
    env: Record<string, string | undefined> = getWorkerEnv()
  ): SubgraphService | null {
    const subgraphUrl = env.SUBGRAPH_URL?.trim()
    console.log('subgraphUrl', subgraphUrl)
    if (!subgraphUrl) {
      return null
    }
    return new SubgraphService(subgraphUrl)
  }

  async listAgentActivities(
    agentId: string,
    limit: number
  ): Promise<SubgraphActivitiesResult> {
    const data = await this.query<{
      _meta: { block: { number: number } }
      agentActivities: SubgraphActivitiesResult['activities']
    }>(AGENT_ACTIVITIES_QUERY, {
      agentId,
      first: limit,
      skip: 0,
    })

    return {
      indexedThroughBlock: String(data._meta.block.number),
      activities: data.agentActivities,
    }
  }

  async listClosedPositions(
    agentId: string,
    limit: number
  ): Promise<SubgraphClosedPositionsResult> {
    const data = await this.query<{
      positions: SubgraphClosedPositionsResult['positions']
    }>(CLOSED_POSITIONS_QUERY, {
      agentId,
      first: limit,
    })

    return { positions: data.positions }
  }

  private async query<T>(
    query: string,
    variables: Record<string, string | number>
  ): Promise<T> {
    let response: Response
    try {
      response = await fetch(this.subgraphUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Subgraph request failed'
      throw new SubgraphError(message)
    }

    if (!response.ok) {
      throw new SubgraphError(
        `Subgraph HTTP ${response.status}: ${response.statusText}`
      )
    }

    const payload = await response.json()
    if (payload.errors?.length) {
      throw new SubgraphError(payload.errors.map((e) => e.message).join('; '))
    }
    if (!payload.data) {
      throw new SubgraphError('Subgraph returned no data')
    }

    return payload.data
  }
}
