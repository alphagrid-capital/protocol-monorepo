// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { TokenRegistry } from "../../src/core/TokenRegistry.sol";
import { MockERC20 } from "../../src/mocks/MockERC20.sol";
import { BaseTest } from "../helpers/BaseTest.sol";
import { MockPriceFeed } from "../mocks/MockPriceFeed.sol";

contract TokenRegistryTest is BaseTest {
    TokenRegistry internal registry;
    MockERC20 internal nvda;
    MockPriceFeed internal nvdaFeed;

    function setUp() public override {
        super.setUp();

        vm.startPrank(deployer);
        registry = new TokenRegistry(deployer);
        nvda = new MockERC20("Mock NVDA", "mNVDA", 18);
        nvdaFeed = new MockPriceFeed(150e8, 8);
        registry.registerToken(address(nvda), address(nvdaFeed));
        vm.stopPrank();
    }

    function test_RegisterToken_StoresConfig() public view {
        assertTrue(registry.isTokenListed(address(nvda)));
        assertTrue(registry.isTokenActive(address(nvda)));
        assertEq(registry.priceFeedOf(address(nvda)), address(nvdaFeed));
        assertEq(registry.tokenDecimals(address(nvda)), 18);
        assertEq(registry.tokenCount(), 1);
        assertEq(registry.tokenAt(0), address(nvda));
    }

    function test_UpdatePriceFeed() public {
        MockPriceFeed newFeed = new MockPriceFeed(200e8, 8);

        vm.prank(deployer);
        registry.updatePriceFeed(address(nvda), address(newFeed));

        assertEq(registry.priceFeedOf(address(nvda)), address(newFeed));
    }

    function test_SetTokenActive_GlobalKillSwitch() public {
        vm.prank(deployer);
        registry.setTokenActive(address(nvda), false);

        assertFalse(registry.isTokenActive(address(nvda)));
        assertTrue(registry.isTokenListed(address(nvda)));
    }

    function test_RevertWhen_RegisterDuplicate() public {
        vm.expectRevert(abi.encodeWithSelector(TokenRegistry.TokenAlreadyListed.selector, address(nvda)));
        vm.prank(deployer);
        registry.registerToken(address(nvda), address(nvdaFeed));
    }

    function test_RevertWhen_UpdateUnlistedToken() public {
        MockERC20 unlisted = new MockERC20("Unlisted", "UNL", 18);

        vm.expectRevert(abi.encodeWithSelector(TokenRegistry.TokenNotListed.selector, address(unlisted)));
        vm.prank(deployer);
        registry.updatePriceFeed(address(unlisted), address(nvdaFeed));
    }
}
