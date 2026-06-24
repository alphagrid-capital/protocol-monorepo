import { abandonStaleAgentDrafts } from './jobs/abandon-stale-agent-drafts.js'
import { updateMockPrices } from './jobs/update-mock-prices.js'
import type { WorkerEnv } from './types/worker-env.js'

export async function handleScheduled(env: WorkerEnv): Promise<void> {
  const [prices, drafts] = await Promise.all([
    updateMockPrices(env),
    abandonStaleAgentDrafts(env),
  ])
  console.log('update-mock-prices', JSON.stringify(prices))
  console.log('abandon-stale-agent-drafts', JSON.stringify(drafts))
}
