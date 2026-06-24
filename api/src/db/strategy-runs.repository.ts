import { AppError } from '../errors.js'
import { requireDb } from '../lib/db/db.js'
import type { WorkerEnv } from '../types/worker-env.js'

export type StrategyRunStatus = 'running' | 'completed' | 'failed'

export interface StrategyRunRow {
  id: string
  agent_id: string
  status: string
  started_at: string
  completed_at: string | null
  context_json: string
  decision_json: string | null
  execution_json: string | null
  error: string | null
}

export type StrategyRunListRow = Omit<StrategyRunRow, 'context_json'>

export interface CreateStrategyRunInput {
  id: string
  agentId: string
  status: StrategyRunStatus
  startedAt: string
  contextJson: string
}

export interface CompleteStrategyRunInput {
  status: StrategyRunStatus
  decisionJson: string | null
  executionJson: string | null
  error: string | null
  completedAt: string
}

export class StrategyRunsRepository {
  constructor(private readonly env: WorkerEnv) {}

  async create(input: CreateStrategyRunInput): Promise<StrategyRunRow> {
    const db = requireDb(this.env)
    const row = await db
      .prepare(
        `INSERT INTO strategy_runs (
           id, agent_id, status, started_at, context_json
         ) VALUES (?, ?, ?, ?, ?)
         RETURNING *`
      )
      .bind(
        input.id,
        input.agentId,
        input.status,
        input.startedAt,
        input.contextJson
      )
      .first<StrategyRunRow>()

    if (!row) {
      throw new AppError('Failed to create strategy run', 503, 'SERVICE_UNAVAILABLE')
    }
    return row
  }

  async complete(
    id: string,
    input: CompleteStrategyRunInput
  ): Promise<StrategyRunRow> {
    const db = requireDb(this.env)
    const row = await db
      .prepare(
        `UPDATE strategy_runs
         SET status = ?,
             decision_json = ?,
             execution_json = ?,
             error = ?,
             completed_at = ?
         WHERE id = ?
         RETURNING *`
      )
      .bind(
        input.status,
        input.decisionJson,
        input.executionJson,
        input.error,
        input.completedAt,
        id
      )
      .first<StrategyRunRow>()

    if (!row) {
      throw new AppError('Strategy run not found', 404)
    }
    return row
  }

  async listByAgentId(agentId: string, limit: number): Promise<StrategyRunListRow[]> {
    const db = requireDb(this.env)
    const result = await db
      .prepare(
        `SELECT id, agent_id, status, started_at, completed_at,
                decision_json, execution_json, error
         FROM strategy_runs
         WHERE agent_id = ?
         ORDER BY started_at DESC
         LIMIT ?`
      )
      .bind(agentId, limit)
      .all<StrategyRunListRow>()

    return result.results ?? []
  }
}
