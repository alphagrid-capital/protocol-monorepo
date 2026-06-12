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

/// @notice Shared MandateVault factory + Genesis vault clone deploy.
abstract contract VaultDeploy is DeploymentEnv {
    bytes32 internal constant MANDATE_GENESIS = "GENESIS";

    struct VaultSet {
        MandateVaultFactory factory;
        MandateVault genesisVault;
    }

    function deployVaults(address vaultAsset, TokenRegistry tokenRegistry_, address admin, address treasury)
        internal
        returns (VaultSet memory vaults)
    {
        IERC20 asset = IERC20(vaultAsset);
        vaults.factory = new MandateVaultFactory(address(0), asset);
        vaults.genesisVault = deployVaultClone(
            vaults.factory,
            asset,
            tokenRegistry_,
            admin,
            treasury,
            "AlphaGrid Genesis Vault",
            "agGEN",
            MANDATE_GENESIS
        );
    }

    function configureVaultTracks(VaultTrackRegistry registry, VaultSet memory vaults) internal {
        VaultTrackPolicies.configureVault(registry, address(vaults.genesisVault));
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
