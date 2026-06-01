import { HTTPFacilitatorClient, x402HTTPResourceServer, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import type { HTTPAdapter, HTTPProcessResult, RoutesConfig } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import type { MiddlewareHandler } from "hono";
import {
  type AgentRegistrationConfig,
  loadAgentRegistrationConfig,
} from "../config/agent-registration.js";
import { fetchRegistrationFeeAtomic, fetchRegistrationFeeUsd } from "./registration-fee.js";
import { deriveX402PaymentId } from "./registration-payment-id.js";
import {
  clearRegistrationRequestState,
  setRegistrationPaymentId,
  stashRegistrationBody,
} from "./registration-request-context.js";
import { getWorkerEnv } from "./worker-env.js";
import { FetchRequestAdapter } from "./fetch-request-adapter.js";

const REGISTER_ROUTE = "POST /agents/register";
export const ZERO_X402_PAYMENT_ID =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

function buildRoutes(config: AgentRegistrationConfig, priceUsd: string): RoutesConfig {
  if (!config.x402.payTo) {
    return {};
  }

  return {
    [REGISTER_ROUTE]: {
      accepts: [
        {
          scheme: "exact",
          price: priceUsd,
          network: config.x402.network as Network,
          payTo: config.x402.payTo,
        },
      ],
      description: "Agent self-registration on AlphaGrid AgentRegistry",
      mimeType: "application/json",
    },
  };
}

async function buildHttpServer(
  config: AgentRegistrationConfig,
  priceUsd: string,
): Promise<x402HTTPResourceServer | null> {
  if (!config.x402.enabled || !config.x402.payTo) return null;

  const facilitator = new HTTPFacilitatorClient({ url: config.x402.facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitator).register(
    config.x402.network as Network,
    new ExactEvmScheme(),
  );

  return new x402HTTPResourceServer(resourceServer, buildRoutes(config, priceUsd));
}

export async function verifyRegistrationPayment(
  request: Request,
  parsedBody?: unknown,
  env: Record<string, string | undefined> = getWorkerEnv(),
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const config = loadAgentRegistrationConfig(env);
  if (!config.x402.enabled || !config.x402.payTo) {
    return { ok: true };
  }

  const feeAtomic = await fetchRegistrationFeeAtomic(config);
  if (feeAtomic === 0n) {
    setRegistrationPaymentId(ZERO_X402_PAYMENT_ID);
    return { ok: true };
  }

  const priceUsd = await fetchRegistrationFeeUsd(config);
  const httpServer = await buildHttpServer(config, priceUsd);
  if (!httpServer) return { ok: true };

  const adapter: HTTPAdapter = new FetchRequestAdapter(
    request,
    "/agents/register",
    parsedBody,
  );

  const result: HTTPProcessResult = await httpServer.processHTTPRequest({
    adapter,
    path: "/agents/register",
    method: "POST",
  });

  if (result.type === "payment-error") {
    return {
      ok: false,
      response: new Response(JSON.stringify(result.response?.body ?? result), {
        status: result.response?.status ?? 402,
        headers: {
          "Content-Type": "application/json",
          ...result.response?.headers,
        },
      }),
    };
  }

  try {
    setRegistrationPaymentId(deriveX402PaymentId(request));
  } catch {
    return {
      ok: false,
      response: Response.json(
        { error: "x402 payment verified but payment id could not be derived" },
        { status: 500 },
      ),
    };
  }

  return { ok: true };
}

export function createRegistrationPaymentMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const config = loadAgentRegistrationConfig(getWorkerEnv());
    if (!config.x402.enabled || !config.x402.payTo) {
      return next();
    }

    let parsedBody: unknown;
    if (c.req.header("content-type")?.includes("application/json")) {
      parsedBody = await c.req.json().catch(() => undefined);
      stashRegistrationBody(parsedBody);
    }

    const payment = await verifyRegistrationPayment(c.req.raw, parsedBody, getWorkerEnv());
    if (!payment.ok) {
      clearRegistrationRequestState();
      return payment.response;
    }

    try {
      await next();
    } finally {
      clearRegistrationRequestState();
    }
  };
}
