# AlphaGrid API

HTTP API and MCP server for AlphaGrid, deployed as a [Cloudflare Worker](https://developers.cloudflare.com/workers/).

REST endpoints and MCP tools share the same service layer so agents and classic HTTP clients see identical data.

## Prerequisites

- Node.js 24+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (installed via `npm install` in this directory)

## Observability

Workers Logs and tracing are enabled in `wrangler.toml` (`observability.enabled`, logs, and traces at 100% head sampling for MVP traffic). After deploy, view invocations in the [Cloudflare dashboard](https://dash.cloudflare.com/) under **Workers & Pages → alphagrid-api → Observability**.

## Commands

```bash
cd api
npm install
npm run typecheck   # TypeScript check (no emit)
npm run dev         # Local dev server (wrangler dev)
npm run deploy      # Deploy to Cloudflare (requires account auth)
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness probe |
| `GET` | `/vaults` | Mock vault catalog with basic stats |
| `GET` | `/docs` | Swagger UI |
| `GET` | `/openapi.json` | OpenAPI 3.1 specification |
| `POST` | `/mcp` | MCP Streamable HTTP (stateless JSON) |

### MCP tools

| Tool | HTTP equivalent |
|------|-----------------|
| `alphagrid_list_vaults` | `GET /vaults` |

Connect MCP clients to `http://localhost:8787/mcp` in development (or your deployed Worker URL). Clients must send `Accept: application/json, text/event-stream` on MCP requests.

## Layout

```text
api/
  src/
    index.ts           # Worker entry (exports fetch handler)
    app.ts             # Hono app, OpenAPI, MCP transport
    mcp/server.ts      # MCP tool registration
    routes/            # OpenAPI HTTP routes
    services/          # Shared business logic (used by HTTP + MCP)
    schemas/           # Zod / OpenAPI schemas
    types/             # TypeScript types
  wrangler.toml
  package.json
```

## CI deployment

Pushes to `main` that touch `api/**` run typecheck, then deploy via [wrangler-action](https://github.com/cloudflare/wrangler-action). Pull requests only run typecheck.

### GitHub repository secrets

Add these under **Settings → Secrets and variables → Actions → Repository secrets**:

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with permission to deploy Workers (see below). |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID ([dashboard](https://dash.cloudflare.com/) → right sidebar on any zone/account overview). |

**Create the API token:** [Cloudflare dashboard → My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token** → use the **Edit Cloudflare Workers** template, or create a custom token with at least:

- **Account** → **Workers Scripts** → **Edit**
- **Account** → **Workers Scripts** → **Read** (included in the template)

`workflow_dispatch` on the API workflow also runs deploy when triggered on `main` (after typecheck passes).

## Environment

Copy `.env.example` to `.env` for local development when bindings and secrets are added. For local deploy, export the same `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` values (or run `wrangler login`).

## Health check

`GET /health` returns `{ "status": "ok", "service": "alphagrid-api" }`.
