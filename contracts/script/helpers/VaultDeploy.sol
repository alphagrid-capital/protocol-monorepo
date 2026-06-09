// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TokenRegistry } from "../../src/core/TokenRegistry.sol";
import { VaultTrackRegistry } from "../../src/core/VaultTrackRegistry.sol";
import { VaultTrackPolicies } from "../config/VaultTrackPolicies.sol";
import { IMandateVaultFactory } from "../../src/interfaces/IMandateVaultFactory.sol";
import { MandateVault } from "../../src/vaults/MandateVault.sol";
import { MandateVaultFactory } from "../../src/vaults/MandateVaultFactory.sol";
import { DeploymentEnv } from "./DeploymentEnv.sol";

/// @notice Shared MandateVault factory + four mandate clone deploy.
abstract contract VaultDeploy is DeploymentEnv {
    bytes32 internal constant MANDATE_FOUNDATION = "FOUNDATION";
    bytes32 internal constant MANDATE_TECH = "TECH";
    bytes32 internal constant MANDATE_VOLATILITY = "VOLATILITY";
    bytes32 internal constant MANDATE_MACRO = "MACRO";

    struct VaultSet {
        MandateVaultFactory factory;
        MandateVault foundationVault;
        MandateVault techVault;
        MandateVault volatilityVault;
        MandateVault macroVault;
    }

    function deployVaults(address usdc, TokenRegistry tokenRegistry_, address admin, address treasury)
        internal
        returns (VaultSet memory vaults)
    {
        IERC20 asset = IERC20(usdc);
        vaults.factory = new MandateVaultFactory(address(0), asset);
        vaults.foundationVault = deployVaultClone(
            vaults.factory, asset, tokenRegistry_, admin, treasury, "AlphaGrid Foundation Vault", "agFND", MANDATE_FOUNDATION
        );
        vaults.techVault = deployVaultClone(
            vaults.factory, asset, tokenRegistry_, admin, treasury, "AlphaGrid Tech Vault", "agTECH", MANDATE_TECH
        );
        vaults.volatilityVault = deployVaultClone(
            vaults.factory,
            asset,
            tokenRegistry_,
            admin,
            treasury,
            "AlphaGrid Volatility Vault",
            "agVOL",
            MANDATE_VOLATILITY
        );
        vaults.macroVault = deployVaultClone(
            vaults.factory, asset, tokenRegistry_, admin, treasury, "AlphaGrid Macro Vault", "agMAC", MANDATE_MACRO
        );
    }

    function configureVaultTracks(VaultTrackRegistry registry, VaultSet memory vaults) internal {
        VaultTrackPolicies.configureVault(registry, address(vaults.foundationVault));
        VaultTrackPolicies.configureVault(registry, address(vaults.techVault));
        VaultTrackPolicies.configureVault(registry, address(vaults.volatilityVault));
        VaultTrackPolicies.configureVault(registry, address(vaults.macroVault));
    }

    function deployVaultClone(
        MandateVaultFactory factory,
        IERC20 asset,
        TokenRegistry tokenRegistry_,
        address admin,
        address treasury,
        string memory shareName,
        string memory shareSymbol,
        bytes32 mandate
    ) internal returns (MandateVault vault) {
        vault = MandateVault(
            factory.deployVault(
                IMandateVaultFactory.VaultDeploymentConfig({
                    asset: asset,
                    shareName: shareName,
                    shareSymbol: shareSymbol,
                    mandate: mandate,
                    tokenRegistry: tokenRegistry_,
                    admin: admin,
                    feeRecipient: treasury
                })
            )
        );
    }
}
