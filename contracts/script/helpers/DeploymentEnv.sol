// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Script } from "forge-std/Script.sol";

/// @notice Shared env loading for deploy scripts.
abstract contract DeploymentEnv is Script {
    struct CoreAddresses {
        address admin;
        address treasury;
        address usdc;
        address backendRelayer;
        address erc8004IdentityRegistry;
    }

    struct TradingAddresses {
        address executor;
        address operator;
        address agentRegistry;
        address allocationManager;
        address vaultTrackRegistry;
    }

    function erc8004ChainId() internal view returns (uint256) {
        return vm.envOr("ERC8004_CHAIN_ID", block.chainid);
    }

    function loadCoreAddresses() internal view returns (CoreAddresses memory addresses) {
        addresses.admin = vm.envAddress("ADMIN");
        addresses.treasury = vm.envAddress("TREASURY");
        addresses.usdc = vm.envAddress("USDC");
        addresses.backendRelayer = vm.envAddress("BACKEND_RELAYER");
        addresses.erc8004IdentityRegistry = vm.envAddress("ERC8004_IDENTITY_REGISTRY");
    }

    /// @dev Returns address(0) when USDC is not set in env.
    function tryLoadUsdc() internal view returns (address) {
        return vm.envOr("USDC", address(0));
    }

    function loadTradingAddresses() internal view returns (TradingAddresses memory addresses) {
        address admin = vm.envAddress("ADMIN");
        addresses.executor = vm.envAddress("EXECUTOR");
        addresses.operator = vm.envOr("OPERATOR", admin);
        addresses.agentRegistry = vm.envAddress("AGENT_REGISTRY");
        addresses.allocationManager = vm.envAddress("ALLOCATION_MANAGER");
        addresses.vaultTrackRegistry = vm.envAddress("VAULT_TRACK_REGISTRY");
    }

    function vaultAddresses() internal view returns (address[] memory vaults) {
        vaults = new address[](4);
        vaults[0] = vm.envAddress("FOUNDATION_VAULT");
        vaults[1] = vm.envAddress("TECH_VAULT");
        vaults[2] = vm.envAddress("VOLATILITY_VAULT");
        vaults[3] = vm.envAddress("MACRO_VAULT");
    }

    function vaultAddressesFrom(address foundation, address tech, address volatility, address macroVault)
        internal
        pure
        returns (address[] memory vaults)
    {
        vaults = new address[](4);
        vaults[0] = foundation;
        vaults[1] = tech;
        vaults[2] = volatility;
        vaults[3] = macroVault;
    }
}
