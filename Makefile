CONTRACTS := contracts

.PHONY: build test fmt fmt-check clean

build:
	cd $(CONTRACTS) && forge build

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
