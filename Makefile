CONTRACTS := contracts

.PHONY: build sync-abis sync-subgraph-abis subgraph-networks subgraph-codegen subgraph-build subgraph-test test fmt fmt-check clean export-deployment

export-deployment:
	@test -n "$(CHAIN)" || (echo "Usage: make export-deployment CHAIN=<chainId>"; exit 1)
	node scripts/export-deployment.mjs $(CHAIN)

build:
	cd $(CONTRACTS) && forge build
	$(MAKE) sync-abis
	$(MAKE) sync-subgraph-abis

sync-abis:
	node scripts/sync-contract-abis.mjs
	cd api && yarn format:abis

sync-subgraph-abis:
	node scripts/sync-subgraph-abis.mjs

subgraph-networks:
	node scripts/generate-subgraph-networks.mjs

subgraph-codegen: sync-subgraph-abis subgraph-networks
	cd subgraph && yarn codegen

subgraph-build: build subgraph-codegen
	cd subgraph && yarn build

subgraph-build-one: build subgraph-codegen
	cd subgraph && graph build --network arbitrum-one

subgraph-test: subgraph-build
	cd subgraph && yarn test

test:
	cd $(CONTRACTS) && forge test

fmt:
	cd $(CONTRACTS) && forge fmt

fmt-check:
	cd $(CONTRACTS) && forge fmt --check

clean:
	cd $(CONTRACTS) && forge clean

ci-test:
	cd $(CONTRACTS) && FOUNDRY_PROFILE=ci forge test
