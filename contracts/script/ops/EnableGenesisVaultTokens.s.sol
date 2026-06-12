// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { console2 } from "forge-std/Script.sol";
import { stdJson } from "forge-std/Script.sol";
import { MandateVault } from "../../src/vaults/MandateVault.sol";
import { DeploymentEnv } from "../helpers/DeploymentEnv.sol";

/// @notice Enables all mock stock tokens on an existing Genesis vault allowlist.
/// @dev Broadcaster needs VAULT_ADMIN_ROLE on the vault. Idempotent: skips tokens
///      that are already allowed. Token addresses are read from deployments/<chainId>.json
///      (or DEPLOYMENT_ARTIFACT). Set GENESIS_VAULT in `.env`.
///
///      forge script script/ops/EnableGenesisVaultTokens.s.sol:EnableGenesisVaultTokens \
///        --rpc-url $RPC_URL --broadcast
contract EnableGenesisVaultTokens is DeploymentEnv {
    using stdJson for string;

    function run() external {
        MandateVault vault = MandateVault(vm.envAddress("GENESIS_VAULT"));
        address[] memory tokens = loadTokenAddresses();

        vm.startBroadcast();
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            if (token == address(0)) continue;

            if (vault.isAllowedToken(token)) {
                console2.log("Skip (already allowed):", token);
                continue;
            }

            vault.enableToken(token);
            console2.log("Enabled:", token);
        }
        vm.stopBroadcast();

        console2.log("Genesis vault:", address(vault));
        console2.log("Allowed token count:", vault.allowedTokenCount());
    }

    function loadTokenAddresses() internal view returns (address[] memory tokens) {
        string memory path = vm.envOr(
            "DEPLOYMENT_ARTIFACT",
            string.concat("./deployments/", vm.toString(block.chainid), ".json")
        );
        string memory json = vm.readFile(path);

        tokens = new address[](8);
        tokens[0] = readTokenAddress(json, "NVDA");
        tokens[1] = readTokenAddress(json, "META");
        tokens[2] = readTokenAddress(json, "TSLA");
        tokens[3] = readTokenAddress(json, "AAPL");
        tokens[4] = readTokenAddress(json, "MSFT");
        tokens[5] = readTokenAddress(json, "COIN");
        tokens[6] = readTokenAddress(json, "HOOD");
        tokens[7] = readTokenAddress(json, "SPY");
    }

    /// @dev DeploymentArtifacts writes flat keys (`tokens.NVDA`); example schema uses nested `tokens.NVDA`.
    function readTokenAddress(string memory json, string memory symbol) internal view returns (address) {
        string memory flatKey = string.concat('.["tokens.', symbol, '"]');
        if (json.keyExists(flatKey)) return json.readAddress(flatKey);
        return json.readAddress(string.concat(".tokens.", symbol));
    }
}
