# AlphaGrid API

Backend API for AlphaGrid, deployed as [Cloudflare Functions](https://developers.cloudflare.com/workers/).

> **Status:** empty scaffold. The package boots and serves a placeholder `501 Not Implemented` response. Endpoints (agent profiles, leaderboards, metadata, admin, public analytics — see [`prd/03_technical_prd.md`](../prd/03_technical_prd.md) §6.1) will be implemented in a later PR.

## Prerequisites

- Node.js 20+
- npm

## Setup

```bash
cd api
npm install
```

## Commands

| Action | Command |
|--------|---------|
| Local dev server | `npm run dev` |
| Type check | `npm run typecheck` |
| Deploy | `npm run deploy` |

`npm run dev` starts `wrangler dev` and serves the worker locally (default `http://localhost:8787`).

## Layout

```text
api/
├── package.json
├── tsconfig.json
├── wrangler.toml          # Cloudflare Worker config
├── .dev.vars.example      # template for local secrets (copy to .dev.vars)
└── src/
    └── index.ts           # entry point (placeholder handler)
```

## Configuration

Runtime bindings (KV, D1, secrets, environment vars) are declared in `wrangler.toml`. Local secrets go in `.dev.vars` (git-ignored); copy `.dev.vars.example` to start.
