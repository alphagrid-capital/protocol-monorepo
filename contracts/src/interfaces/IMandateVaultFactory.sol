// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ITokenRegistry } from "./ITokenRegistry.sol";

/// @title IMandateVaultFactory
/// @notice EIP-1167 minimal-clone deployment of MandateVault instances (immutable, not centrally upgradeable).
interface IMandateVaultFactory {
    struct VaultDeploymentConfig {
        IERC20 asset;
        string shareName;
        string shareSymbol;
        bytes32 mandate;
        ITokenRegistry tokenRegistry;
        address admin;
        address feeRecipient;
    }

    event VaultDeployed(address indexed proxy, bytes32 mandate, string name, string symbol);

    function deployVault(VaultDeploymentConfig calldata cfg) external returns (address proxy);

    function implementation() external view returns (address);

    function asset() external view returns (address);

    function vaultCount() external view returns (uint256);

    function vaultAt(uint256 index) external view returns (address);
}
