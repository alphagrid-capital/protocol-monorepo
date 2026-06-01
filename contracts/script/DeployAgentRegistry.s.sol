// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Script, console2 } from "forge-std/Script.sol";
import { AgentRegistry } from "../src/core/AgentRegistry.sol";
import { IFeeManager } from "../src/interfaces/IFeeManager.sol";

contract DeployAgentRegistry is Script {
    function run() external returns (AgentRegistry registry) {
        address admin = vm.envAddress("ADMIN");
        IFeeManager feeManager = IFeeManager(vm.envAddress("FEE_MANAGER"));

        vm.startBroadcast();
        registry = new AgentRegistry(admin, feeManager);
        vm.stopBroadcast();

        console2.log("AgentRegistry:", address(registry));
        console2.log("Admin:", admin);
        console2.log("FeeManager:", address(feeManager));
        console2.log("Note: call setVaultTrackRegistry and configure vault CHALLENGE tracks before registration");
    }
}
