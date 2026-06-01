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

const quoteRoute = createRoute({
  method: "get",
  path: "/agents/register/quote",
  tags: ["Agents"],
  summary: "Agent registration quote",
  description:
    "Returns EIP-712 domain data, registration fee, and x402 payment requirements for `selfRegisterAgent` on AgentRegistry.",
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
    "Self-register an agent on AgentRegistry. Requires a valid EIP-712 SelfRegister signature. " +
    "When x402 is enabled, the registration fee is collected via HTTP 402 (USDC on Base) before calldata is returned.",
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
  },
});

export const agentRoutes = new OpenAPIHono();

const paymentMiddleware = createRegistrationPaymentMiddleware();
if (paymentMiddleware) {
  agentRoutes.use("/agents/register", paymentMiddleware);
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
    if (error instanceof AgentRegistrationError) {
      return c.json({ error: error.message }, error.status as 400);
    }
    throw error;
  }
});
