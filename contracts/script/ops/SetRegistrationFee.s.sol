// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { console2 } from "forge-std/Script.sol";
import { FeeManager } from "../../src/core/FeeManager.sol";
import { Fees } from "../config/Fees.sol";
import { DeploymentEnv } from "../helpers/DeploymentEnv.sol";

/// @notice Sets FeeManager registration fee to 0.1 USDC (6-decimal asset).
/// @dev Broadcaster needs FEE_ADMIN_ROLE. Set FEE_MANAGER in `.env`.
contract SetRegistrationFee is DeploymentEnv {
    function run() external {
        FeeManager feeManager = FeeManager(vm.envAddress("FEE_MANAGER"));

        vm.startBroadcast();
        feeManager.setRegistrationFee(Fees.REGISTRATION_FEE);
        vm.stopBroadcast();

        console2.log("FeeManager:", address(feeManager));
        console2.log("Registration fee (raw):", Fees.REGISTRATION_FEE);
        console2.log("Registration fee (USDC): 0.1");
    }
}
