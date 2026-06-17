#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/subgraph"

if [[ -z "${DEPLOY_KEY:-}" ]]; then
  echo "Set DEPLOY_KEY from Subgraph Studio before deploying."
  echo "  graph auth \$DEPLOY_KEY"
  exit 1
fi

NETWORK="${1:-}"
if [[ -z "$NETWORK" ]]; then
  echo "Usage: scripts/deploy-subgraph.sh <arbitrum-sepolia|arbitrum-one>"
  exit 1
fi

case "$NETWORK" in
  arbitrum-sepolia)
    SLUG="alphagrid-protocol-subgraph-arbitrum-sepolia"
    ;;
  arbitrum-one)
    SLUG="alphagrid-protocol-subgraph-arbitrum-one"
    ;;
  *)
    echo "Unsupported network: $NETWORK"
    exit 1
    ;;
esac

cd "$ROOT"
make subgraph-build

cd "$ROOT/subgraph"
yarn graph auth "$DEPLOY_KEY"
yarn graph deploy "$SLUG" \
  --network "$NETWORK" \
  --version-label "${VERSION_LABEL:-v0.0.1}"

echo "Deployed $SLUG on $NETWORK"
echo "Set SUBGRAPH_URL on the matching API Worker (see subgraph/README.md)."
