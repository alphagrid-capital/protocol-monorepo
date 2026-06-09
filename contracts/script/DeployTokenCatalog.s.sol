// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { console2 } from "forge-std/Script.sol";
import { MockERC20 } from "../src/mocks/MockERC20.sol";
import { TokenRegistry } from "../src/core/TokenRegistry.sol";
import { MandateVault } from "../src/vaults/MandateVault.sol";
import { TokenCatalog } from "./config/TokenCatalog.sol";
import { DeploymentEnv } from "./helpers/DeploymentEnv.sol";

/// @notice Deploys mock stock ERC20s, registers them, and enables per-vault allowlists.
/// @dev Run after DeployPriceOracle (TOKEN_REGISTRY must have priceOracle set). Prices are not
///      seeded here — the API cron keeper calls MockPriceOracle.setPrices.
contract DeployTokenCatalog is DeploymentEnv {
    function run() external {
        TokenCatalog.StockDef[] memory defs = TokenCatalog.stockDefs();
        uint256 n = defs.length;
        address[] memory tokens = new address[](n);

        vm.startBroadcast();

        for (uint256 i = 0; i < n; i++) {
            tokens[i] = address(new MockERC20(defs[i].name, defs[i].symbol, 18));
            console2.log("MockERC20", defs[i].symbol, tokens[i]);
        }

        TokenCatalog.registerAll(TokenRegistry(vm.envAddress("TOKEN_REGISTRY")), tokens);
        TokenCatalog.enableVaultTokens(
            tokens,
            MandateVault(vm.envAddress("FOUNDATION_VAULT")),
            MandateVault(vm.envAddress("TECH_VAULT")),
            MandateVault(vm.envAddress("VOLATILITY_VAULT")),
            MandateVault(vm.envAddress("MACRO_VAULT"))
        );

        vm.stopBroadcast();

        console2.log("Deployed", n, "mock stocks; copy addresses into config/token-catalog.json");
    }
}
