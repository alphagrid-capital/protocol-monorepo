// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Script, console2 } from "forge-std/Script.sol";
import { AgentRegistry } from "../src/core/AgentRegistry.sol";
import { FeeManager } from "../src/core/FeeManager.sol";
import { TrackConfig } from "../src/core/TrackConfig.sol";

/// @notice Deploys Phase 1 core contracts: FeeManager, TrackConfig, and AgentRegistry.
contract DeployPhase1 is Script {
    function run() external returns (FeeManager feeManager, TrackConfig trackConfig, AgentRegistry registry) {
        address admin = vm.envAddress("ADMIN");
        address treasury = vm.envAddress("TREASURY");
        address usdc = vm.envAddress("USDC");
        uint256 registrationFeeAmount = vm.envUint("REGISTRATION_FEE_AMOUNT");

        vm.startBroadcast();

        feeManager = new FeeManager(admin, treasury, usdc);
        trackConfig = new TrackConfig(admin);
        registry = new AgentRegistry(admin, feeManager);

        feeManager.setAgentRegistry(address(registry));
        registry.setTrackConfig(trackConfig);

        if (registrationFeeAmount > 0) {
            feeManager.setRegistrationFee(registrationFeeAmount);
        }

        vm.stopBroadcast();

        console2.log("FeeManager:", address(feeManager));
        console2.log("TrackConfig:", address(trackConfig));
        console2.log("AgentRegistry:", address(registry));
        console2.log("Admin:", admin);
        console2.log("Treasury:", treasury);
        console2.log("Fee asset (USDC):", usdc);
    }
}
