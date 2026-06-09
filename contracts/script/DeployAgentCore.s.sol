// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { console2 } from "forge-std/Script.sol";
import { AgentRegistry } from "../src/core/AgentRegistry.sol";
import { FeeManager } from "../src/core/FeeManager.sol";
import { VaultTrackRegistry } from "../src/core/VaultTrackRegistry.sol";
import { Fees } from "./config/Fees.sol";
import { AgentCoreDeploy } from "./helpers/AgentCoreDeploy.sol";

/// @notice Deploys agent onboarding core: FeeManager, VaultTrackRegistry, and AgentRegistry.
/// @dev Pipeline: deploy → wire → setRoles
contract DeployAgentCore is AgentCoreDeploy {
    function run()
        external
        returns (FeeManager feeManager, VaultTrackRegistry vaultTrackRegistry, AgentRegistry registry)
    {
        CoreAddresses memory env = loadCoreAddresses();
        uint256 registrationFeeAmount = vm.envOr("REGISTRATION_FEE_AMOUNT", Fees.REGISTRATION_FEE);

        vm.startBroadcast();
        AgentCoreDeployed memory deployed = deployAgentCore(env.admin, env.treasury, env.usdc, false);
        wireAgentCore(deployed, registrationFeeAmount);
        grantRegistrarRole(deployed.registry, env.backendRelayer);
        vm.stopBroadcast();

        feeManager = deployed.feeManager;
        vaultTrackRegistry = deployed.vaultTrackRegistry;
        registry = deployed.registry;

        _log(deployed, env);
    }

    function _log(AgentCoreDeployed memory deployed, CoreAddresses memory env) private pure {
        console2.log("FeeManager:", address(deployed.feeManager));
        console2.log("VaultTrackRegistry:", address(deployed.vaultTrackRegistry));
        console2.log("AgentRegistry:", address(deployed.registry));
        console2.log("Admin:", env.admin);
        console2.log("Treasury:", env.treasury);
        console2.log("Fee asset (USDC):", env.usdc);
    }
}
