CONTRACTS := contracts

.PHONY: build sync-abis test fmt fmt-check clean export-deployment

export-deployment:
	@test -n "$(CHAIN)" || (echo "Usage: make export-deployment CHAIN=<chainId>"; exit 1)
	node scripts/export-deployment.mjs $(CHAIN)

build:
	cd $(CONTRACTS) && forge build
	$(MAKE) sync-abis

sync-abis:
	node scripts/sync-contract-abis.mjs
	cd api && yarn format:abis

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
