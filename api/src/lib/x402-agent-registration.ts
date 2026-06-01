import { paymentMiddlewareFromConfig } from "@x402/hono";
import { HTTPFacilitatorClient, x402HTTPResourceServer, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import type { HTTPAdapter, HTTPProcessResult, RoutesConfig } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import type { MiddlewareHandler } from "hono";
import {
  type AgentRegistrationConfig,
  loadAgentRegistrationConfig,
} from "../config/agent-registration.js";
import { FetchRequestAdapter } from "./fetch-request-adapter.js";

const REGISTER_ROUTE = "POST /agents/register";

let cachedHttpServer: x402HTTPResourceServer | null | undefined;

function buildRoutes(config: AgentRegistrationConfig): RoutesConfig {
  if (!config.x402.payTo) {
    return {};
  }

  return {
    [REGISTER_ROUTE]: {
      accepts: [
        {
          scheme: "exact",
          price: config.registrationFeeUsd,
          network: config.x402.network as Network,
          payTo: config.x402.payTo,
        },
      ],
      description: "Agent self-registration on AlphaGrid AgentRegistry",
      mimeType: "application/json",
    },
  };
}

function buildHttpServer(config: AgentRegistrationConfig): x402HTTPResourceServer | null {
  if (!config.x402.enabled || !config.x402.payTo) return null;

  const facilitator = new HTTPFacilitatorClient({ url: config.x402.facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitator).register(
    config.x402.network as Network,
    new ExactEvmScheme(),
  );

  return new x402HTTPResourceServer(resourceServer, buildRoutes(config));
}

export function getRegistrationX402HttpServer(): x402HTTPResourceServer | null {
  if (cachedHttpServer !== undefined) return cachedHttpServer;
  const config = loadAgentRegistrationConfig();
  cachedHttpServer = buildHttpServer(config);
  return cachedHttpServer;
}

export function createRegistrationPaymentMiddleware(): MiddlewareHandler | null {
  const config = loadAgentRegistrationConfig();
  if (!config.x402.enabled || !config.x402.payTo) return null;

  const routes = buildRoutes(config);
  if (Object.keys(routes).length === 0) return null;

  return paymentMiddlewareFromConfig(
    routes,
    new HTTPFacilitatorClient({ url: config.x402.facilitatorUrl }),
    [{ network: config.x402.network as Network, server: new ExactEvmScheme() }],
  );
}

export async function verifyRegistrationPayment(
  request: Request,
  parsedBody?: unknown,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const config = loadAgentRegistrationConfig();
  if (!config.x402.enabled || !config.x402.payTo) {
    return { ok: true };
  }

  const httpServer = getRegistrationX402HttpServer();
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
