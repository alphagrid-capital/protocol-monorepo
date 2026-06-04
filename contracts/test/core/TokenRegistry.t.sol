// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { TokenRegistry } from "../../src/core/TokenRegistry.sol";
import { MockERC20 } from "../../src/mocks/MockERC20.sol";
import { MockPriceOracle } from "../../src/mocks/MockPriceOracle.sol";
import { BaseTest } from "../helpers/BaseTest.sol";

contract TokenRegistryTest is BaseTest {
    TokenRegistry internal registry;
    MockPriceOracle internal oracle;
    MockERC20 internal nvda;

    function setUp() public override {
        super.setUp();

        vm.startPrank(deployer);
        registry = new TokenRegistry(deployer);
        oracle = new MockPriceOracle(deployer);
        registry.setPriceOracle(address(oracle));
        nvda = new MockERC20("Mock NVDA", "mNVDA", 18);
        oracle.setPrice(address(nvda), 150e8);
        registry.registerToken(address(nvda));
        vm.stopPrank();
    }

    function test_RegisterToken_StoresConfig() public view {
        assertTrue(registry.isTokenListed(address(nvda)));
        assertTrue(registry.isTokenActive(address(nvda)));
        assertEq(registry.priceOracle(), address(oracle));
        assertEq(registry.tokenDecimals(address(nvda)), 18);
        assertEq(registry.tokenCount(), 1);
        assertEq(registry.tokenAt(0), address(nvda));
    }

    function test_SetPriceOracle() public {
        MockPriceOracle newOracle = new MockPriceOracle(deployer);

        vm.prank(deployer);
        registry.setPriceOracle(address(newOracle));

        assertEq(registry.priceOracle(), address(newOracle));
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
        registry.registerToken(address(nvda));
    }

    function test_RevertWhen_RegisterWithoutOracle() public {
        TokenRegistry fresh = new TokenRegistry(deployer);
        MockERC20 token = new MockERC20("Fresh", "FRSH", 18);

        vm.expectRevert(TokenRegistry.PriceOracleNotSet.selector);
        vm.prank(deployer);
        fresh.registerToken(address(token));
    }
}
