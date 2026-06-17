// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { console2 } from "forge-std/Script.sol";
import { MockERC20 } from "../../src/mocks/MockERC20.sol";
import { TokenRegistry } from "../../src/core/TokenRegistry.sol";
import { MandateVault } from "../../src/vaults/MandateVault.sol";
import { TokenCatalog } from "../config/TokenCatalog.sol";
import { DeploymentEnv } from "../helpers/DeploymentEnv.sol";

/// @notice Deploys incremental mock stocks (GOOGL, AMZN), registers them, and enables Genesis vault.
/// @dev Run once per chain after the original 8-stock catalog. Broadcaster needs REGISTRY_ADMIN_ROLE
///      on TokenRegistry and VAULT_ADMIN_ROLE on Genesis vault. Set TOKEN_REGISTRY and GENESIS_VAULT.
///
///      forge script script/ops/DeployAdditionalTokens.s.sol:DeployAdditionalTokens \
///        --rpc-url $RPC_URL --broadcast
contract DeployAdditionalTokens is DeploymentEnv {
    uint256 internal constant ADDITIONAL_START_INDEX = 8;

    function run() external {
        TokenRegistry registry = TokenRegistry(vm.envAddress("TOKEN_REGISTRY"));
        MandateVault vault = MandateVault(vm.envAddress("GENESIS_VAULT"));
        TokenCatalog.StockDef[] memory defs = TokenCatalog.stockDefs();

        vm.startBroadcast();

        for (uint256 i = ADDITIONAL_START_INDEX; i < defs.length; i++) {
            MockERC20 token = new MockERC20(defs[i].name, defs[i].symbol, 18);
            address tokenAddr = address(token);
            console2.log("MockERC20", defs[i].symbol, tokenAddr);

            registry.registerToken(tokenAddr);

            if (vault.isAllowedToken(tokenAddr)) {
                console2.log("Skip vault enable (already allowed):", tokenAddr);
            } else {
                vault.enableToken(tokenAddr);
                console2.log("Enabled on Genesis vault:", tokenAddr);
            }
        }

        vm.stopBroadcast();

        console2.log("TokenRegistry:", address(registry));
        console2.log("Genesis vault:", address(vault));
        console2.log("Registry token count:", registry.tokenCount());
        console2.log("Genesis allowed token count:", vault.allowedTokenCount());
        console2.log("Copy GOOGL/AMZN addresses into api/src/contracts/token-catalog.json");
    }
}
