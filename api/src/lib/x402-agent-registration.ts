import { HTTPFacilitatorClient, x402HTTPResourceServer, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import type { HTTPAdapter, HTTPProcessResult, RoutesConfig } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import type { MiddlewareHandler } from "hono";
import {
  type AgentRegistrationConfig,
  loadAgentRegistrationConfig,
} from "../config/agent-registration.js";
import { RegistrationFeeService } from "../services/fee-manager.service.js";
import { getWorkerEnv } from "./worker-env.js";
import { FetchRequestAdapter } from "./fetch-request-adapter.js";

const REGISTER_ROUTE = "POST /agents/register";

function buildRoutes(
  config: AgentRegistrationConfig,
  priceUsd: string,
  payTo: `0x${string}` | null,
): RoutesConfig {
  if (!payTo) {
    return {};
  }

  return {
    [REGISTER_ROUTE]: {
      accepts: [
        {
          scheme: "exact",
          price: priceUsd,
          network: config.x402.network as Network,
          payTo,
        },
      ],
      description: "Agent registration on AlphaGrid AgentRegistry via backend registrar",
      mimeType: "application/json",
    },
  };
}

async function buildHttpServer(
  config: AgentRegistrationConfig,
  priceUsd: string,
  payTo: `0x${string}` | null,
): Promise<x402HTTPResourceServer | null> {
  if (!payTo) return null;

  const facilitator = new HTTPFacilitatorClient({ url: config.x402.facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitator).register(
    config.x402.network as Network,
    new ExactEvmScheme(),
  );

  return new x402HTTPResourceServer(resourceServer, buildRoutes(config, priceUsd, payTo));
}

export async function verifyRegistrationPayment(
  request: Request,
  parsedBody?: unknown,
  env: Record<string, string | undefined> = getWorkerEnv(),
  feeState?: { amount: bigint; treasury: `0x${string}` | null; displayUsd: string },
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const config = loadAgentRegistrationConfig(env);
  const registrationFeeState = feeState ?? (await new RegistrationFeeService(config).getDetails());
  if (registrationFeeState.amount === 0n) {
    return { ok: true };
  }

  if (!registrationFeeState.treasury) {
    return {
      ok: false,
      response: Response.json(
        { error: "FeeManager.treasury is unavailable for registration fee collection" },
        { status: 503 },
      ),
    };
  }

  const httpServer = await buildHttpServer(
    config,
    registrationFeeState.displayUsd,
    registrationFeeState.treasury,
  );
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

  return { ok: true };
}

export function createRegistrationPaymentMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const config = loadAgentRegistrationConfig(getWorkerEnv());
    const feeState = await new RegistrationFeeService(config).getDetails();
    if (feeState.amount === 0n) {
      return next();
    }

    let parsedBody: unknown;
    if (c.req.header("content-type")?.includes("application/json")) {
      parsedBody = await c.req.raw.clone().json().catch(() => undefined);
    }

    const payment = await verifyRegistrationPayment(c.req.raw, parsedBody, getWorkerEnv(), feeState);
    if (!payment.ok) {
      return payment.response;
    }
    await next();
  };
}
