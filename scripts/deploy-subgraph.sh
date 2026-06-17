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

resolve_version_label() {
  if [[ -n "${VERSION_LABEL:-}" ]]; then
    echo "$VERSION_LABEL"
    return
  fi
  if git -C "$ROOT" rev-parse --short HEAD >/dev/null 2>&1; then
    echo "build-$(git -C "$ROOT" rev-parse --short HEAD)"
    return
  fi
  echo "build-$(date -u +%Y%m%dT%H%M%SZ)"
}

VERSION_LABEL="$(resolve_version_label)"

cd "$ROOT"
make subgraph-build

cd "$ROOT/subgraph"
yarn graph auth "$DEPLOY_KEY"
echo "Deploying $SLUG with version label: $VERSION_LABEL"
yarn graph deploy "$SLUG" \
  --network "$NETWORK" \
  --version-label "$VERSION_LABEL"

echo "Deployed $SLUG on $NETWORK (version: $VERSION_LABEL)"
echo "Verify schema includes equitySnapshots on Agent, then set SUBGRAPH_URL (see subgraph/README.md)."
