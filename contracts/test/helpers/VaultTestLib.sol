// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IMandateVaultFactory } from "../../src/interfaces/IMandateVaultFactory.sol";
import { ITokenRegistry } from "../../src/interfaces/ITokenRegistry.sol";
import { MandateVault } from "../../src/vaults/MandateVault.sol";
import { MandateVaultFactory } from "../../src/vaults/MandateVaultFactory.sol";

/// @notice Test helper for EIP-1167 clone vault deployment.
library VaultTestLib {
    function deployFactory(IERC20 asset) internal returns (MandateVaultFactory factory, MandateVault implementation) {
        implementation = new MandateVault(asset);
        factory = new MandateVaultFactory(address(implementation), asset);
    }

    function deployVault(
        MandateVaultFactory factory,
        IERC20 asset,
        string memory shareName,
        string memory shareSymbol,
        bytes32 mandate,
        ITokenRegistry tokenRegistry,
        address admin,
        address feeRecipient
    ) internal returns (MandateVault vault) {
        address proxy = factory.deployVault(
            IMandateVaultFactory.VaultDeploymentConfig({
                asset: asset,
                shareName: shareName,
                shareSymbol: shareSymbol,
                mandate: mandate,
                tokenRegistry: tokenRegistry,
                admin: admin,
                feeRecipient: feeRecipient
            })
        );
        return MandateVault(proxy);
    }
}
