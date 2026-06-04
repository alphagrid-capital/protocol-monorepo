import type { MiddlewareHandler } from 'hono'
import { ROUTE_PATHS } from '../constants/routes.js'
import { loadAgentRegistrationConfig } from './agent-registration-config.js'
import { FeeManagerService } from '../services/fee-manager.service.js'
import { getWorkerEnv } from './worker-env.js'
import { runX402HonoPayment, runX402ProtectedRequest } from './x402.js'
import type { X402PaymentConfig } from './x402.js'

const REGISTER_METHOD = 'POST'
interface RegistrationFeeState {
  amount: bigint
  treasury: `0x${string}` | null
  displayUsd: string
}
const REGISTER_DESCRIPTION =
  'Agent registration on AlphaGrid AgentRegistry via backend registrar'

function missingTreasuryResponse(): Response {
  return Response.json(
    {
      error:
        'FeeManager.treasury is unavailable for registration fee collection',
    },
    { status: 503 }
  )
}

function buildRegistrationPaymentConfig(
  env: Record<string, string | undefined>,
  feeState: RegistrationFeeState
): X402PaymentConfig {
  const config = loadAgentRegistrationConfig(env)
  return {
    method: REGISTER_METHOD,
    path: ROUTE_PATHS.agentRegister,
    description: REGISTER_DESCRIPTION,
    mimeType: 'application/json',
    priceUsd: feeState.displayUsd,
    payTo: feeState.treasury!,
    network: config.x402.network,
    facilitatorUrl: config.x402.facilitatorUrl,
  }
}

async function loadRegistrationFeeState(
  env: Record<string, string | undefined>
): Promise<RegistrationFeeState> {
  const config = loadAgentRegistrationConfig(env)
  return new FeeManagerService(config).getRegistrationFee()
}

export async function runRegistrationWithPayment<T>(options: {
  request: Request
  parsedBody?: unknown
  env?: Record<string, string | undefined>
  handler: () => Promise<T>
  toResponseBody: (value: T) => string
}): Promise<{ ok: true; value: T } | { ok: false; response: Response }> {
  const env = options.env ?? getWorkerEnv()
  const feeState = await loadRegistrationFeeState(env)
  if (feeState.amount === 0n) {
    return { ok: true, value: await options.handler() }
  }

  if (!feeState.treasury) {
    return { ok: false, response: missingTreasuryResponse() }
  }

  return runX402ProtectedRequest({
    payment: buildRegistrationPaymentConfig(env, feeState),
    request: options.request,
    parsedBody: options.parsedBody,
    handler: options.handler,
    toResponseBody: options.toResponseBody,
  })
}

export function createRegistrationPaymentMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const env = getWorkerEnv()
    const feeState = await loadRegistrationFeeState(env)
    if (feeState.amount === 0n) {
      return next()
    }

    if (!feeState.treasury) {
      return missingTreasuryResponse()
    }

    await runX402HonoPayment(
      c,
      buildRegistrationPaymentConfig(env, feeState),
      next
    )
  }
}
