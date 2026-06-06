import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getMcpTools } from "@coinbase/agentkit-model-context-protocol";
import { getAgentKit } from "./getAgentKit.js";

export interface WorkerEnv {
  NETWORK_ID?: string;
  WALLET_PROVIDER?: string;
  CDP_API_KEY_ID?: string;
  CDP_API_KEY_SECRET?: string;
  CDP_WALLET_SECRET?: string;
  ADDRESS?: string;
  OWNER_ADDRESS?: string;
  RPC_URL?: string;
  PAYMASTER_URL?: string;
  PRIVATE_KEY?: string;
  [key: string]: string | undefined;
}

function applyWorkerEnv(env: WorkerEnv): void {
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string" && value.length > 0) {
      process.env[key] = value;
    }
  }
}

async function createMcpServer(): Promise<Server> {
  const agentKit = await getAgentKit();
  const { tools, toolHandler } = await getMcpTools(agentKit);

  const server = new Server(
    {
      name: "agentkit",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      return toolHandler(request.params.name, request.params.arguments);
    } catch (error) {
      throw new Error(`Tool ${request.params.name} failed: ${error}`);
    }
  });

  return server;
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    applyWorkerEnv(env);

    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ status: "ok" });
    }

    if (url.pathname === "/mcp") {
      const transport = new WebStandardStreamableHTTPServerTransport();
      const server = await createMcpServer();
      await server.connect(transport);
      return transport.handleRequest(request);
    }

    return new Response("Not Found", { status: 404 });
  },
};
