import { absoluteUrl } from "./base-url.js";

const HTTP_METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
] as const;

/** Paths that are metadata, not primary data fetches for URL paste tools. */
const NON_FETCHABLE_GET_PATHS = new Set(["/", "/docs/swagger.json"]);

type PathItem = Partial<Record<(typeof HTTP_METHODS)[number], OperationObject>>;
type OperationObject = Record<string, unknown>;

export interface ListedOperation {
  method: string;
  path: string;
  url: string;
  summary: string;
  description: string;
  tags: string[];
  formats: string[];
}

export interface McpDiscovery {
  method: string;
  url: string;
  note: string;
  tools: string[];
}

export interface ApiDiscoveryPayload {
  name: string;
  version: string;
  description: string;
  baseUrl: string;
  documentation: {
    openapi: string;
    swaggerUi: string;
    llmsTxt: string;
  };
  /** All HTTP operations from the OpenAPI document. */
  operations: ListedOperation[];
  /** GET operations suitable for ChatGPT-style URL fetching. */
  fetchableEndpoints: ListedOperation[];
  mcp: McpDiscovery;
  hints: {
    forChatGptBrowsing: string;
    forCustomGptActions: string;
    forMcpClients: string;
  };
}

function joinUrl(base: string, path: string): string {
  return new URL(path, base.endsWith("/") ? base : `${base}/`).href;
}

function contentTypesFromOperation(operation: OperationObject): string[] {
  const responses = operation.responses as
    | Record<string, { content?: Record<string, unknown> }>
    | undefined;
  const types = new Set<string>();
  for (const response of Object.values(responses ?? {})) {
    for (const mediaType of Object.keys(response.content ?? {})) {
      types.add(mediaType);
    }
  }
  return [...types];
}

/** Lists operations from an OpenAPI 3.1 document produced by `@hono/zod-openapi`. */
export function listOperationsFromOpenApi(
  doc: Record<string, unknown>,
  serverUrl: string,
): ListedOperation[] {
  const paths = doc.paths as Record<string, PathItem> | undefined;
  const operations: ListedOperation[] = [];

  for (const [path, pathItem] of Object.entries(paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;

      operations.push({
        method: method.toUpperCase(),
        path,
        url: joinUrl(serverUrl, path),
        summary: String(operation.summary ?? path),
        description: String(operation.description ?? operation.summary ?? ""),
        tags: Array.isArray(operation.tags)
          ? operation.tags.map(String)
          : [],
        formats: contentTypesFromOperation(operation),
      });
    }
  }

  return operations.sort((a, b) =>
    a.path === b.path
      ? a.method.localeCompare(b.method)
      : a.path.localeCompare(b.path),
  );
}

export function buildDiscoveryFromOpenApi(
  doc: Record<string, unknown>,
  requestUrl: string,
  mcp: McpDiscovery,
): ApiDiscoveryPayload {
  const info = doc.info as
    | { title?: string; version?: string; description?: string }
    | undefined;
  const serverUrl =
    (doc.servers as { url: string }[] | undefined)?.[0]?.url ??
    absoluteUrl(requestUrl, "/");

  const operations = listOperationsFromOpenApi(doc, serverUrl);
  const fetchableEndpoints = operations.filter(
    (op) => op.method === "GET" && !NON_FETCHABLE_GET_PATHS.has(op.path),
  );

  const vaults = fetchableEndpoints.find((op) => op.path === "/vaults");
  const vaultsMd = vaults ? `${vaults.url}?format=md` : joinUrl(serverUrl, "/vaults?format=md");
  const openapiUrl = absoluteUrl(requestUrl, "/docs/swagger.json");

  return {
    name: String(info?.title ?? "AlphaGrid API"),
    version: String(info?.version ?? "0.0.0"),
    description: String(info?.description ?? ""),
    baseUrl: serverUrl,
    documentation: {
      openapi: openapiUrl,
      swaggerUi: absoluteUrl(requestUrl, "/docs"),
      llmsTxt: absoluteUrl(requestUrl, "/llms.txt"),
    },
    operations,
    fetchableEndpoints,
    mcp,
    hints: {
      forChatGptBrowsing: vaults
        ? `Use ${vaults.url} or ${vaultsMd} (from OpenAPI). Avoid /docs — it is HTML Swagger UI.`
        : "Use GET data endpoints listed under fetchableEndpoints (from OpenAPI).",
      forCustomGptActions: `Import OpenAPI from ${openapiUrl}.`,
      forMcpClients: `Connect to ${mcp.url} with Accept: application/json, text/event-stream`,
    },
  };
}

export function buildLlmsTxtFromOpenApi(
  doc: Record<string, unknown>,
  requestUrl: string,
  mcp: McpDiscovery,
): string {
  const info = doc.info as
    | { title?: string; description?: string }
    | undefined;
  const serverUrl =
    (doc.servers as { url: string }[] | undefined)?.[0]?.url ??
    absoluteUrl(requestUrl, "/");

  const operations = listOperationsFromOpenApi(doc, serverUrl);
  const title = String(info?.title ?? "AlphaGrid API");
  const description = String(info?.description ?? "");

  const lines = [
    `# ${title}`,
    "",
    `> ${description}`,
    "",
    "Generated from the OpenAPI specification. Fetchable GET URLs are listed first.",
    "",
    "## Data (fetch these)",
    "",
  ];

  for (const op of operations) {
    if (op.method !== "GET" || NON_FETCHABLE_GET_PATHS.has(op.path)) continue;
    const detail = op.description || op.summary;
    lines.push(`- [${op.summary}](${op.url}): ${op.method} — ${detail}`);
    if (op.path === "/vaults") {
      lines.push(
        `- [${op.summary} (Markdown)](${op.url}?format=md): GET — same data as plain markdown`,
      );
    }
  }

  lines.push("", "## API (from OpenAPI)", "");
  for (const op of operations) {
    if (op.method === "GET" && op.path === "/") continue;
    const detail = op.description || op.summary;
    lines.push(`- [${op.method} ${op.path}](${op.url}): ${detail}`);
  }

  lines.push(
    "",
    "## Documentation",
    "",
    `- [OpenAPI 3.1](${absoluteUrl(requestUrl, "/docs/swagger.json")}): Machine-readable spec (source of truth)`,
    `- [Swagger UI](${absoluteUrl(requestUrl, "/docs")}): Interactive docs (HTML, not for URL paste)`,
    `- [Discovery JSON](${absoluteUrl(requestUrl, "/")}): Index derived from OpenAPI`,
    "",
    "## MCP",
    "",
    `- MCP endpoint: ${mcp.method} ${mcp.url} — ${mcp.note}`,
    `- Tools: ${mcp.tools.map((t) => `\`${t}\``).join(", ")}`,
    "",
    "## Optional",
    "",
    "- [Source repository](https://github.com/alphagrid-prop/contracts/tree/main/api)",
  );

  return lines.join("\n").trimEnd();
}
