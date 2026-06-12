// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { console2 } from "forge-std/Script.sol";
import { AgentRegistry } from "../src/core/AgentRegistry.sol";
import { AllocationManager } from "../src/core/AllocationManager.sol";
import { FeeManager } from "../src/core/FeeManager.sol";
import { TokenRegistry } from "../src/core/TokenRegistry.sol";
import { VaultTrackRegistry } from "../src/core/VaultTrackRegistry.sol";
import { MandateVault } from "../src/vaults/MandateVault.sol";
import { MandateVaultFactory } from "../src/vaults/MandateVaultFactory.sol";
import { AgentCoreDeploy } from "./helpers/AgentCoreDeploy.sol";
import { VaultDeploy } from "./helpers/VaultDeploy.sol";

/// @notice Greenfield deploy: agent core, token registry, Genesis vault clone, track configs, and AllocationManager wiring.
/// @dev Pipeline: deploy → wire → setRoles → configure tracks. Edit VaultTrackPolicies before mainnet.
contract DeployVaultInfrastructure is AgentCoreDeploy, VaultDeploy {
    function run()
        external
        returns (
            FeeManager feeManager,
            VaultTrackRegistry vaultTrackRegistry,
            TokenRegistry tokenRegistry,
            AgentRegistry registry,
            AllocationManager allocationManager,
            MandateVaultFactory vaultFactory,
            MandateVault genesisVault
        )
    {
        CoreAddresses memory env = loadCoreAddresses();
        address vaultAsset = requireVaultAsset();

        vm.startBroadcast();
        AgentCoreDeployed memory core = deployAgentCore(env.admin, env.treasury, env.feeAsset, true);
        VaultSet memory vaults = deployVaults(vaultAsset, core.tokenRegistry, env.admin, env.treasury);
        wireAgentCore(core, 0);
        grantRegistrarRole(core.registry, env.backendRelayer);
        configureVaultTracks(core.vaultTrackRegistry, vaults);
        vm.stopBroadcast();

        feeManager = core.feeManager;
        vaultTrackRegistry = core.vaultTrackRegistry;
        tokenRegistry = core.tokenRegistry;
        registry = core.registry;
        allocationManager = core.allocationManager;
        vaultFactory = vaults.factory;
        genesisVault = vaults.genesisVault;

        _log(core, vaults, env, vaultAsset);
    }

    function _log(AgentCoreDeployed memory core, VaultSet memory vaults, CoreAddresses memory env, address vaultAsset)
        private
        view
    {
        console2.log("Fee asset:", env.feeAsset);
        console2.log("Vault asset:", vaultAsset);
        console2.log("FeeManager:", address(core.feeManager));
        console2.log("VaultTrackRegistry:", address(core.vaultTrackRegistry));
        console2.log("TokenRegistry:", address(core.tokenRegistry));
        console2.log("AgentRegistry:", address(core.registry));
        console2.log("AllocationManager:", address(core.allocationManager));
        console2.log("VaultFactory:", address(vaults.factory));
        console2.log("VaultImplementation:", vaults.factory.implementation());
        console2.log("GenesisVault:", address(vaults.genesisVault));
    }
}
