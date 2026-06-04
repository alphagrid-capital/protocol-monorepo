// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Script, console2 } from "forge-std/Script.sol";
import { FeeManager } from "../src/core/FeeManager.sol";

/// @notice Sets FeeManager registration fee to 0.1 USDC (6-decimal asset).
/// @dev Broadcaster needs FEE_ADMIN_ROLE. Set FEE_MANAGER in `.env`.
contract SetRegistrationFee is Script {
    /// @dev 0.1 USDC with 6 decimals.
    uint256 internal constant REGISTRATION_FEE = 100_000;

    function run() external {
        FeeManager feeManager = FeeManager(vm.envAddress("FEE_MANAGER"));

        vm.startBroadcast();
        feeManager.setRegistrationFee(REGISTRATION_FEE);
        vm.stopBroadcast();

        console2.log("FeeManager:", address(feeManager));
        console2.log("Registration fee (raw):", REGISTRATION_FEE);
        console2.log("Registration fee (USDC): 0.1");
    }
}
