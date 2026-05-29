// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Test } from "forge-std/Test.sol";
import { MockERC20 } from "../../src/mocks/MockERC20.sol";

/// @notice Shared test setup for AlphaGrid contract tests.
abstract contract BaseTest is Test {
    address internal deployer;
    address internal alice;
    address internal bob;

    MockERC20 internal usdc;

    function setUp() public virtual {
        deployer = makeAddr("deployer");
        alice = makeAddr("alice");
        bob = makeAddr("bob");

        vm.startPrank(deployer);
        usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        vm.stopPrank();
    }
}
