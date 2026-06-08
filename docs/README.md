# AlphaGrid docs

Public-facing documentation site powered by [Mintlify](https://mintlify.com).

## Local preview

Requires Node.js 20.17+:

```bash
cd docs
yarn install
yarn dev
```

Open http://localhost:3000.

## Format

Uses [`@mintlify/prettier-config`](https://www.npmjs.com/package/@mintlify/prettier-config):

```bash
cd docs
yarn format        # write
yarn format:check  # CI check
```

## Deploy

1. Push this repository to GitHub.
2. Connect the repo in the [Mintlify dashboard](https://mintlify.com/start) and set the docs root to `docs/`.
