import { updateMockPrices } from './jobs/update-mock-prices.js'
import type { WorkerEnv } from './types/worker-env.js'

export async function handleScheduled(env: WorkerEnv): Promise<void> {
  const result = await updateMockPrices(env)
  console.log('update-mock-prices', JSON.stringify(result))
}
