// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Script, console2 } from "forge-std/Script.sol";
import { AgentRegistry } from "../src/core/AgentRegistry.sol";
import { FeeManager } from "../src/core/FeeManager.sol";
import { VaultTrackRegistry } from "../src/core/VaultTrackRegistry.sol";

/// @notice Deploys agent onboarding core: FeeManager, VaultTrackRegistry, and AgentRegistry.
contract DeployAgentCore is Script {
    function run()
        external
        returns (FeeManager feeManager, VaultTrackRegistry vaultTrackRegistry, AgentRegistry registry)
    {
        address admin = vm.envAddress("ADMIN");
        address treasury = vm.envAddress("TREASURY");
        address usdc = vm.envAddress("USDC");
        uint256 registrationFeeAmount = vm.envUint("REGISTRATION_FEE_AMOUNT");

        vm.startBroadcast();

        feeManager = new FeeManager(admin, treasury, usdc);
        vaultTrackRegistry = new VaultTrackRegistry(admin);
        registry = new AgentRegistry(admin, feeManager);

        feeManager.setAgentRegistry(address(registry));
        registry.setVaultTrackRegistry(vaultTrackRegistry);

        if (registrationFeeAmount > 0) {
            feeManager.setRegistrationFee(registrationFeeAmount);
        }

        vm.stopBroadcast();

        console2.log("FeeManager:", address(feeManager));
        console2.log("VaultTrackRegistry:", address(vaultTrackRegistry));
        console2.log("AgentRegistry:", address(registry));
        console2.log("Admin:", admin);
        console2.log("Treasury:", treasury);
        console2.log("Fee asset (USDC):", usdc);
    }
}
