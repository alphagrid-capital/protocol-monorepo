// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Script, console2 } from "forge-std/Script.sol";
import { MockERC20 } from "../src/mocks/MockERC20.sol";

contract DeployMockERC20 is Script {
    function run() external returns (MockERC20 token) {
        vm.startBroadcast();
        token = new MockERC20("Mock USDC", "mUSDC", 6);
        vm.stopBroadcast();

        console2.log("MockERC20:", address(token));
    }
}
