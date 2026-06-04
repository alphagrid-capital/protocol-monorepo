import { createApp } from './app.js'
import { runWithWorkerEnv } from './lib/worker-env.js'
import type { WorkerEnv } from './types/worker-env.js'

const app = createApp()

export default {
  fetch(
    request: Request,
    env: WorkerEnv,
    _ctx: ExecutionContext
  ): Response | Promise<Response> {
    return runWithWorkerEnv(env, () => app.fetch(request, env))
  },
}
