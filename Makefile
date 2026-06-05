CONTRACTS := contracts

.PHONY: build sync-abis test fmt fmt-check clean

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
