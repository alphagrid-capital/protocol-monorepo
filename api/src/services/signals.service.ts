import { SignalsCacheRepository } from '../db/signals-cache.repository.js'
import { SignalsService } from '../lib/signals/load-signals.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import type { WorkerEnv } from '../types/worker-env.js'
import { ApifyService } from './apify.service.js'
import { FredService } from './fred.service.js'

export { SignalsService } from '../lib/signals/load-signals.js'

export function createSignalsService(
  env: WorkerEnv = getWorkerEnv()
): SignalsService {
  return new SignalsService(
    env,
    new SignalsCacheRepository(env),
    ApifyService.fromEnv(env),
    FredService.fromEnv(env)
  )
}
