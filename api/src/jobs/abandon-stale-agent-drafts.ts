import { AgentDraftsRepository } from '../db/agent-drafts.repository.js'
import type { WorkerEnv } from '../types/worker-env.js'

const STALE_DRAFT_DAYS = 30

export async function abandonStaleAgentDrafts(
  env: WorkerEnv
): Promise<{ abandoned: number }> {
  const cutoff = new Date(
    Date.now() - STALE_DRAFT_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()
  const updatedAt = new Date().toISOString()
  const abandoned = await new AgentDraftsRepository(env).abandonStale(
    cutoff,
    updatedAt
  )
  return { abandoned }
}
