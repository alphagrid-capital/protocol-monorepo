import { ROUTE_PATHS } from '../constants/routes.js'
import { SOURCE_REPOSITORY_URL } from '../constants/project.js'
import { absoluteUrl } from './url-utils.js'

const HTTP_METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
] as const

/** Paths that are metadata, not primary data fetches for URL paste tools. */
const NON_FETCHABLE_GET_PATHS = new Set<string>([
  ROUTE_PATHS.discovery,
  ROUTE_PATHS.swaggerJson,
])

type PathItem = Partial<Record<(typeof HTTP_METHODS)[number], OperationObject>>
type OperationObject = Record<string, unknown>

function asText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return fallback
}

export interface ListedOperation {
  method: string
  path: string
  url: string
  summary: string
  description: string
  tags: string[]
  formats: string[]
}

export interface McpDiscovery {
  method: string
  url: string
  note: string
  tools: string[]
}

export interface ApiDiscoveryPayload {
  name: string
  version: string
  description: string
  baseUrl: string
  documentation: {
    openapi: string
    swaggerUi: string
    llmsTxt: string
  }
  /** All HTTP operations from the OpenAPI document. */
  operations: ListedOperation[]
  /** GET operations suitable for ChatGPT-style URL fetching. */
  fetchableEndpoints: ListedOperation[]
  mcp: McpDiscovery
  hints: {
    forChatGptBrowsing: string
    forCustomGptActions: string
    forMcpClients: string
  }
}

function contentTypesFromOperation(operation: OperationObject): string[] {
  const responses = operation.responses as
    | Record<string, { content?: Record<string, unknown> }>
    | undefined
  const types = new Set<string>()
  for (const response of Object.values(responses ?? {})) {
    for (const mediaType of Object.keys(response.content ?? {})) {
      types.add(mediaType)
    }
  }
  return [...types]
}

/** Lists operations from an OpenAPI 3.1 document produced by `@hono/zod-openapi`. */
export function listOperationsFromOpenApi(
  doc: Record<string, unknown>,
  serverUrl: string
): ListedOperation[] {
  const paths = doc.paths as Record<string, PathItem> | undefined
  const operations: ListedOperation[] = []

  for (const [path, pathItem] of Object.entries(paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method]
      if (!operation) {
        continue
      }

      operations.push({
        method: method.toUpperCase(),
        path,
        url: absoluteUrl(serverUrl, path),
        summary: asText(operation.summary, path),
        description: asText(
          operation.description,
          asText(operation.summary, '')
        ),
        tags: Array.isArray(operation.tags) ? operation.tags.map(String) : [],
        formats: contentTypesFromOperation(operation),
      })
    }
  }

  return operations.sort((a, b) =>
    a.path === b.path
      ? a.method.localeCompare(b.method)
      : a.path.localeCompare(b.path)
  )
}

export function buildDiscoveryFromOpenApi(
  doc: Record<string, unknown>,
  requestUrl: string,
  mcp: McpDiscovery
): ApiDiscoveryPayload {
  const info = doc.info as
    | { title?: string; version?: string; description?: string }
    | undefined
  const serverUrl =
    (doc.servers as { url: string }[] | undefined)?.[0]?.url ??
    absoluteUrl(requestUrl, ROUTE_PATHS.discovery)

  const operations = listOperationsFromOpenApi(doc, serverUrl)
  const fetchableEndpoints = operations.filter(
    (op) => op.method === 'GET' && !NON_FETCHABLE_GET_PATHS.has(op.path)
  )

  const vaults = fetchableEndpoints.find((op) => op.path === ROUTE_PATHS.vaults)
  const vaultsMd = vaults
    ? `${vaults.url}?format=md`
    : absoluteUrl(serverUrl, `${ROUTE_PATHS.vaults}?format=md`)
  const openapiUrl = absoluteUrl(requestUrl, ROUTE_PATHS.swaggerJson)

  return {
    name: String(info?.title ?? ''),
    version: String(info?.version ?? ''),
    description: String(info?.description ?? ''),
    baseUrl: serverUrl,
    documentation: {
      openapi: openapiUrl,
      swaggerUi: absoluteUrl(requestUrl, ROUTE_PATHS.docs),
      llmsTxt: absoluteUrl(requestUrl, ROUTE_PATHS.llmsTxt),
    },
    operations,
    fetchableEndpoints,
    mcp,
    hints: {
      forChatGptBrowsing: vaults
        ? `Use ${vaults.url} or ${vaultsMd} (from OpenAPI). Avoid /docs — it is HTML Swagger UI.`
        : 'Use GET data endpoints listed under fetchableEndpoints (from OpenAPI).',
      forCustomGptActions: `Import OpenAPI from ${openapiUrl}.`,
      forMcpClients: `Connect to ${mcp.url} with Accept: application/json, text/event-stream`,
    },
  }
}

export function buildLlmsTxtFromOpenApi(
  doc: Record<string, unknown>,
  requestUrl: string,
  mcp: McpDiscovery
): string {
  const info = doc.info as { title?: string; description?: string } | undefined
  const serverUrl =
    (doc.servers as { url: string }[] | undefined)?.[0]?.url ??
    absoluteUrl(requestUrl, ROUTE_PATHS.discovery)

  const operations = listOperationsFromOpenApi(doc, serverUrl)
  const title = String(info?.title ?? '')
  const description = String(info?.description ?? '')

  const lines = [
    `# ${title}`,
    '',
    `> ${description}`,
    '',
    'Generated from the OpenAPI specification. Fetchable GET URLs are listed first.',
    '',
    '## Data (fetch these)',
    '',
  ]

  for (const op of operations) {
    if (op.method !== 'GET' || NON_FETCHABLE_GET_PATHS.has(op.path)) {
      continue
    }
    const detail = op.description || op.summary
    lines.push(`- [${op.summary}](${op.url}): ${op.method} — ${detail}`)
    if (op.path === ROUTE_PATHS.vaults) {
      lines.push(
        `- [${op.summary} (Markdown)](${op.url}?format=md): GET — same data as plain markdown`
      )
    }
  }

  lines.push('', '## API (from OpenAPI)', '')
  for (const op of operations) {
    if (op.method === 'GET' && op.path === ROUTE_PATHS.discovery) {
      continue
    }
    const detail = op.description || op.summary
    lines.push(`- [${op.method} ${op.path}](${op.url}): ${detail}`)
  }

  lines.push(
    '',
    '## Documentation',
    '',
    `- [OpenAPI 3.1](${absoluteUrl(requestUrl, ROUTE_PATHS.swaggerJson)}): Machine-readable spec (source of truth)`,
    `- [Swagger UI](${absoluteUrl(requestUrl, ROUTE_PATHS.docs)}): Interactive docs (HTML, not for URL paste)`,
    `- [Discovery JSON](${absoluteUrl(requestUrl, ROUTE_PATHS.discovery)}): Index derived from OpenAPI`,
    '',
    '## MCP',
    '',
    `- MCP endpoint: ${mcp.method} ${mcp.url} — ${mcp.note}`,
    `- Tools: ${mcp.tools.map((t) => `\`${t}\``).join(', ')}`,
    '',
    '## Optional',
    '',
    `- [Source repository](${SOURCE_REPOSITORY_URL})`
  )

  return lines.join('\n').trimEnd()
}
