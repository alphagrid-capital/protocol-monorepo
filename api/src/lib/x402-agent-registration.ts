import type { MiddlewareHandler } from "hono";
import { loadAgentRegistrationConfig } from "./agent-registration-config.js";
import { RegistrationFeeService } from "../services/fee-manager.service.js";
import { getWorkerEnv } from "./worker-env.js";
import {
  createX402Middleware,
  verifyX402Payment,
  type X402PaymentConfig,
} from "./x402.js";

const REGISTER_METHOD = "POST";
const REGISTER_PATH = "/agents/register";
type RegistrationFeeState = {
  amount: bigint;
  treasury: `0x${string}` | null;
  displayUsd: string;
};
const REGISTER_DESCRIPTION =
  "Agent registration on AlphaGrid AgentRegistry via backend registrar";

function missingTreasuryResponse(): Response {
  return Response.json(
    {
      error:
        "FeeManager.treasury is unavailable for registration fee collection",
    },
    { status: 503 },
  );
}

function buildRegistrationPaymentConfig(
  env: Record<string, string | undefined>,
  feeState: RegistrationFeeState,
): X402PaymentConfig {
  const config = loadAgentRegistrationConfig(env);
  return {
    method: REGISTER_METHOD,
    path: REGISTER_PATH,
    description: REGISTER_DESCRIPTION,
    mimeType: "application/json",
    priceUsd: feeState.displayUsd,
    payTo: feeState.treasury as `0x${string}`,
    network: config.x402.network,
    facilitatorUrl: config.x402.facilitatorUrl,
  };
}

export async function verifyRegistrationPayment(
  request: Request,
  parsedBody?: unknown,
  env: Record<string, string | undefined> = getWorkerEnv(),
  feeState?: RegistrationFeeState,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const config = loadAgentRegistrationConfig(env);
  const registrationFeeState =
    feeState ?? (await new RegistrationFeeService(config).getDetails());
  if (registrationFeeState.amount === 0n) {
    return { ok: true };
  }

  if (!registrationFeeState.treasury) {
    return { ok: false, response: missingTreasuryResponse() };
  }

  return verifyX402Payment({
    payment: buildRegistrationPaymentConfig(env, registrationFeeState),
    request,
    parsedBody,
  });
}

export function createRegistrationPaymentMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const env = getWorkerEnv();
    const config = loadAgentRegistrationConfig(env);
    const feeState = await new RegistrationFeeService(config).getDetails();
    if (feeState.amount === 0n) {
      return next();
    }

    if (!feeState.treasury) {
      return missingTreasuryResponse();
    }

    const middleware = await createX402Middleware(
      buildRegistrationPaymentConfig(env, feeState),
    );
    return middleware(c, next);
  };
}
