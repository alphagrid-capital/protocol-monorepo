import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  AgentRegistrationQuoteSchema,
  AgentRegistrationRequestSchema,
  AgentRegistrationResponseSchema,
} from "../schemas/agent.js";
import {
  AgentRegistrationError,
  getAgentRegistrationQuote,
  registerAgent,
} from "../services/agent-registration.js";
import { createRegistrationPaymentMiddleware } from "../lib/x402-agent-registration.js";
import { getWorkerEnv } from "../lib/worker-env.js";
import { AppError } from "../errors.js";

const quoteRoute = createRoute({
  method: "get",
  path: "/agents/register/quote",
  tags: ["Agents"],
  summary: "Agent registration quote",
  description:
    "Returns EIP-712 domain data, registration fee, and x402 payment requirements for backend-mediated registration on AgentRegistry.",
  request: {
    query: z.object({
      signer: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/)
        .optional()
        .openapi({ description: "Optional signer address to read the current registration nonce" }),
    }),
  },
  responses: {
    200: {
      description: "Registration quote",
      content: { "application/json": { schema: AgentRegistrationQuoteSchema } },
    },
  },
});

const registerRoute = createRoute({
  method: "post",
  path: "/agents/register",
  tags: ["Agents"],
  summary: "Register agent (x402 + AgentRegistry)",
  description:
    "Register an agent on AgentRegistry through the backend registrar. Requires a valid EIP-712 SelfRegister signature. " +
    "When x402 is enabled, the registration fee is collected via HTTP 402 (USDC) and the relayer submits registerAgent in the same request.",
  request: {
    body: {
      content: { "application/json": { schema: AgentRegistrationRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Registration accepted",
      content: { "application/json": { schema: AgentRegistrationResponseSchema } },
    },
    400: { description: "Invalid request or signature" },
    402: { description: "x402 payment required" },
    502: { description: "On-chain registration failed" },
    503: { description: "Server or relayer configuration error" },
  },
});

export const agentRoutes = new OpenAPIHono();

agentRoutes.use("/agents/register", createRegistrationPaymentMiddleware());

function statusFromError(error: AppError): 400 | 402 | 502 | 503 {
  if (error.status === 400 || error.status === 402 || error.status === 502 || error.status === 503) {
    return error.status;
  }
  return 503;
}

agentRoutes.openapi(quoteRoute, async (c) => {
  const signer = c.req.query("signer") as `0x${string}` | undefined;
  const quote = await getAgentRegistrationQuote(signer, getWorkerEnv());
  return c.json(quote, 200);
});

agentRoutes.openapi(registerRoute, async (c) => {
  try {
    const body = c.req.valid("json");
    const result = await registerAgent(body, getWorkerEnv());
    return c.json(result, 200);
  } catch (error) {
    if (error instanceof AppError || error instanceof AgentRegistrationError) {
      return c.json({ error: error.message }, statusFromError(error));
    }
    throw error;
  }
});
