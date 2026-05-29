// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { MockERC20 } from "../../src/mocks/MockERC20.sol";
import { BaseTest } from "../helpers/BaseTest.sol";

contract MockERC20Test is BaseTest {
    MockERC20 internal token;

    uint256 internal constant INITIAL_SUPPLY = 1_000_000e18;

    function setUp() public override {
        super.setUp();
        token = new MockERC20("Mock USDC", "mUSDC", 18);
    }

    function test_Metadata() public view {
        assertEq(token.name(), "Mock USDC");
        assertEq(token.symbol(), "mUSDC");
        assertEq(token.decimals(), 18);
    }

    function test_DeployerReceivesInitialSupply() public view {
        assertEq(token.balanceOf(address(this)), INITIAL_SUPPLY);
        assertEq(token.totalSupply(), INITIAL_SUPPLY);
    }

    function test_MintIncreasesBalanceAndSupply() public {
        uint256 amount = 100e18;
        token.mint(alice, amount);

        assertEq(token.balanceOf(alice), amount);
        assertEq(token.totalSupply(), INITIAL_SUPPLY + amount);
    }

    function test_BurnDecreasesBalanceAndSupply() public {
        token.mint(alice, 50e18);
        token.burn(alice, 20e18);

        assertEq(token.balanceOf(alice), 30e18);
        assertEq(token.totalSupply(), INITIAL_SUPPLY + 30e18);
    }

    function test_Transfer() public {
        token.mint(alice, 100e18);

        vm.prank(alice);
        bool ok = token.transfer(bob, 40e18);

        assertTrue(ok);
        assertEq(token.balanceOf(alice), 60e18);
        assertEq(token.balanceOf(bob), 40e18);
    }

    function test_ApproveAndTransferFrom() public {
        token.mint(alice, 100e18);

        vm.startPrank(alice);
        token.approve(bob, 25e18);
        vm.stopPrank();

        vm.prank(bob);
        bool ok = token.transferFrom(alice, bob, 25e18);

        assertTrue(ok);
        assertEq(token.balanceOf(alice), 75e18);
        assertEq(token.balanceOf(bob), 25e18);
    }

    function testFuzz_Mint(uint96 amount) public {
        amount = uint96(bound(amount, 1, type(uint96).max));
        token.mint(alice, amount);
        assertEq(token.balanceOf(alice), amount);
    }
}
