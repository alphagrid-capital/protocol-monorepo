import { StrategyRunnerService } from '../services/strategy-runner.service.js'
import type { StrategyRunnerTickResult } from '../services/strategy-runner.service.js'
import type { WorkerEnv } from '../types/worker-env.js'

export async function runStrategyRunner(
  env: WorkerEnv
): Promise<StrategyRunnerTickResult> {
  return StrategyRunnerService.fromEnv(env).tick()
}
