// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IMandateVaultFactory } from "../interfaces/IMandateVaultFactory.sol";
import { MandateVault } from "./MandateVault.sol";

/// @title MandateVaultFactory
/// @notice Deploys EIP-1167 minimal clones of a shared MandateVault implementation (not upgradeable).
contract MandateVaultFactory is IMandateVaultFactory {
    IERC20 public immutable ASSET;
    address public immutable IMPLEMENTATION;

    address[] private _vaults;

    error ZeroAddress();
    error AssetMismatch(address expected, address provided);

    /// @param implementation_ Pre-deployed vault implementation, or `address(0)` to deploy one bound to `asset_`.
    /// @param asset_ ERC-4626 underlying asset baked into the implementation (must match every clone config).
    constructor(address implementation_, IERC20 asset_) {
        if (address(asset_) == address(0)) revert ZeroAddress();

        ASSET = asset_;
        address impl = implementation_;
        if (impl == address(0)) {
            impl = address(new MandateVault(asset_));
        }
        IMPLEMENTATION = impl;
    }

    /// @inheritdoc IMandateVaultFactory
    function deployVault(VaultDeploymentConfig calldata cfg) external returns (address proxy) {
        if (cfg.admin == address(0) || address(cfg.tokenRegistry) == address(0)) revert ZeroAddress();
        if (address(cfg.asset) != address(ASSET)) {
            revert AssetMismatch(address(ASSET), address(cfg.asset));
        }

        proxy = Clones.clone(IMPLEMENTATION);
        MandateVault(proxy)
            .initialize(cfg.shareName, cfg.shareSymbol, cfg.mandate, cfg.tokenRegistry, cfg.admin, cfg.feeRecipient);

        _vaults.push(proxy);
        emit VaultDeployed(proxy, cfg.mandate, cfg.shareName, cfg.shareSymbol);
    }

    /// @inheritdoc IMandateVaultFactory
    function implementation() external view returns (address) {
        return IMPLEMENTATION;
    }

    /// @inheritdoc IMandateVaultFactory
    function asset() external view returns (address) {
        return address(ASSET);
    }

    /// @inheritdoc IMandateVaultFactory
    function vaultCount() external view returns (uint256) {
        return _vaults.length;
    }

    /// @inheritdoc IMandateVaultFactory
    function vaultAt(uint256 index) external view returns (address) {
        return _vaults[index];
    }
}
