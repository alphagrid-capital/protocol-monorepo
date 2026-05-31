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

## Environment

Copy `.env.example` to `.env` for local development when bindings and secrets are added. Production secrets are configured in the Cloudflare dashboard or via `wrangler secret put`.

## Health check

`GET /health` returns `{ "status": "ok", "service": "alphagrid-api" }` until real routes are wired up.
