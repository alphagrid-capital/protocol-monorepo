# AlphaGrid project context

Read this when writing docs in the AlphaGrid monorepo. The parent `SKILL.md` stays generic; this file holds repo-specific paths and conventions.

## Docs site

Public Mintlify site: `docs/`. Read `docs/docs.json` before structural changes.

| Area | Location |
|------|----------|
| Site config & navigation | `docs/docs.json` |
| MDX pages | `docs/**/*.mdx` |
| Local preview | `cd docs && yarn dev` |
| CI | `yarn format:check`, `yarn validate`, `yarn broken-links` (`.github/workflows/docs.yml`) |
| Platform mechanics | `.agents/skills/mintlify-docs/SKILL.md` |

**Navigation groups:** Overview → Build an agent (includes Integrate, API, contracts, HTTP API) → Capital providers → Help.

**Integrate group:** narrative MDX (`integrations/integrate`, `reference/api-mcp`) plus auto-generated **HTTP API** pages from the live OpenAPI URL in `docs.json`. Do not hand-maintain endpoint tables for those routes in MDX.

**OpenAPI:** `https://api-421614.alphagrid.capital/docs/swagger.json` (remote URL in `docs.json`, not vendored). Contextual menu: `copy`, `download-spec`, `chatgpt`, `claude`.

**Style:** Aspen theme, dark default, sentence-case headings, root-relative links without `.mdx` (e.g. `/agents/agent-guide`). No em dashes; use commas, periods, colons, or parentheses.

## Where truth lives

| Topic | Read first | Docs role |
|-------|------------|-----------|
| HTTP API | `api/src/`, `api/README.md` | Guides + Mintlify pages from live `swagger.json` |
| MCP | `api/src/` MCP layer | `reference/api-mcp.mdx`: transport/setup only; tools must match code |
| Contracts, EIP-712 | `contracts/src/`, `contracts/docs/`, `api/src/constants/contracts.ts` | `reference/contracts.mdx` |
| Local wallet | `agents/wallet-mcp/`, `alphagrid-wallet-mcp` skill | Integration guides |
| Product intent | `prd/` | Background only: verify against code before stating as fact |

## Generated vs hand-written

**Do not duplicate in MDX:** OpenAPI endpoint pages (Integrate → HTTP API), `/docs/swagger.json`, `/llms.txt`, `GET /` discovery JSON.

**Hand-written:** concepts, workflows, glossary, FAQ: every fact must trace to code, tests, or deployed behavior.

## Mintlify frontmatter (this repo)

`title` and `description` required; `keywords` optional. No duplicate `#` H1 matching the frontmatter title.

```mdx
---
title: 'Agent guide'
description: 'Register, trade, and progress through AlphaGrid tracks'
---
```

New pages must be added to `docs.json` navigation.
