// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { console2 } from "forge-std/Script.sol";
import { MockERC20 } from "../../src/mocks/MockERC20.sol";
import { DeploymentEnv } from "./DeploymentEnv.sol";

/// @notice Resolves fee and vault stablecoin addresses for deploy scripts.
abstract contract AssetDeploy is DeploymentEnv {
    string internal constant MOCK_STABLE_NAME = "Mocked Stable";
    string internal constant MOCK_STABLE_SYMBOL = "mSTBL";
    uint8 internal constant MOCK_STABLE_DECIMALS = 6;

    struct ResolvedAssets {
        address feeAsset;
        address vaultAsset;
    }

    /// @dev `FEE_ASSET` / `VAULT_ASSET` override legacy `USDC`. When only one is set, the other
    ///      may default to the same address or deploy a mock vault asset (see `resolveAssets`).
    function resolveAssets(bool deployVaultMockIfMissing) internal returns (ResolvedAssets memory resolved) {
        AssetAddresses memory assets = loadAssetAddresses();

        if (assets.vaultAsset != address(0)) {
            resolved.vaultAsset = assets.vaultAsset;
        } else if (deployVaultMockIfMissing) {
            resolved.vaultAsset = address(
                new MockERC20(MOCK_STABLE_NAME, MOCK_STABLE_SYMBOL, MOCK_STABLE_DECIMALS)
            );
            console2.log("Deployed Mocked Stable (vault asset):", resolved.vaultAsset);
        } else {
            revert("VAULT_ASSET or USDC required");
        }

        if (assets.feeAsset != address(0)) {
            resolved.feeAsset = assets.feeAsset;
        } else {
            resolved.feeAsset = resolved.vaultAsset;
            console2.log("Fee asset defaults to vault asset:", resolved.feeAsset);
        }
    }

}
