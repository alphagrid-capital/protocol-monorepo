# AlphaGrid API

HTTP API for AlphaGrid, deployed as [Cloudflare Workers](https://developers.cloudflare.com/workers/).

This package is a scaffold only. Endpoints described in [`prd/03_technical_prd.md`](../prd/03_technical_prd.md) (section 8) will be implemented in a follow-up PR.

## Prerequisites

- Node.js 20+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (installed via `npm install` in this directory)

## Commands

```bash
cd api
npm install
npm run typecheck   # TypeScript check (no emit)
npm run dev         # Local dev server (wrangler dev)
npm run deploy      # Deploy to Cloudflare (requires account auth)
```

## Layout

```text
api/
  src/index.ts    # Worker entry (fetch handler)
  wrangler.toml   # Cloudflare Worker config
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

If you add custom routes or domains later, you may also need **Workers Routes** (zone) **Edit**.

`workflow_dispatch` on the API workflow also runs deploy when triggered on `main` (after typecheck passes).

## Environment

Copy `.env.example` to `.env` for local development when bindings and secrets are added. For local deploy, export the same `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` values (or run `wrangler login`). Worker runtime secrets are configured in the Cloudflare dashboard or via `wrangler secret put`.

## Health check

`GET /health` returns `{ "status": "ok", "service": "alphagrid-api" }` until real routes are wired up.
