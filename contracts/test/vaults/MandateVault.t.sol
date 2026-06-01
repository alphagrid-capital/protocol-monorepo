// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TokenRegistry } from "../../src/core/TokenRegistry.sol";
import { OracleLib } from "../../src/libraries/OracleLib.sol";
import { MockERC20 } from "../../src/mocks/MockERC20.sol";
import { MandateVault } from "../../src/vaults/MandateVault.sol";
import { MandateVaultFactory } from "../../src/vaults/MandateVaultFactory.sol";
import { BaseTest } from "../helpers/BaseTest.sol";
import { VaultTestLib } from "../helpers/VaultTestLib.sol";
import { MockPriceFeed } from "../mocks/MockPriceFeed.sol";

contract MandateVaultTest is BaseTest {
    bytes32 internal constant VAULT_MANDATE = "TECH";

    MandateVaultFactory internal vaultFactory;
    TokenRegistry internal registry;
    MandateVault internal vault;
    MockERC20 internal nvda;
    MockPriceFeed internal nvdaFeed;

    address internal lp;
    address internal feeRecipient;

    uint256 internal constant DEPOSIT_FEE_BPS = 50; // 0.5%
    uint256 internal constant WITHDRAW_FEE_BPS = 50; // 0.5%

    function setUp() public override {
        super.setUp();

        lp = makeAddr("lp");
        feeRecipient = makeAddr("feeRecipient");

        vm.startPrank(deployer);
        registry = new TokenRegistry(deployer);
        (vaultFactory,) = VaultTestLib.deployFactory(IERC20(address(usdc)));
        vault = VaultTestLib.deployVault(
            vaultFactory,
            IERC20(address(usdc)),
            "AlphaGrid Tech Vault",
            "agTECH",
            VAULT_MANDATE,
            registry,
            deployer,
            feeRecipient
        );

        nvda = new MockERC20("Mock NVDA", "mNVDA", 18);
        nvdaFeed = new MockPriceFeed(150e8, 8);
        registry.registerToken(address(nvda), address(nvdaFeed));
        vault.enableToken(address(nvda));
        vault.setMaxPriceAge(1 hours);

        usdc.mint(lp, 1_000_000e6);
        vm.stopPrank();
    }

    function test_DepositMintsShares() public {
        vm.startPrank(lp);
        usdc.approve(address(vault), 100_000e6);
        uint256 shares = vault.deposit(100_000e6, lp);
        vm.stopPrank();

        assertGt(shares, 0);
        assertEq(vault.balanceOf(lp), shares);
        assertEq(vault.totalAssets(), 100_000e6);
    }

    function test_WithdrawCappedByIdleUsdc() public {
        vm.startPrank(lp);
        usdc.approve(address(vault), 100_000e6);
        vault.deposit(100_000e6, lp);
        vm.stopPrank();

        nvda.mint(address(vault), 10e18);

        assertGt(vault.totalAssets(), 100_000e6);
        assertEq(vault.idleAssets(), 100_000e6);
        assertEq(vault.maxWithdraw(lp), 100_000e6);

        vm.prank(lp);
        vault.withdraw(100_000e6, lp, lp);
        assertEq(usdc.balanceOf(lp), 1_000_000e6);
    }

    function test_TotalAssetsIncludesAllowedTokenValue() public {
        vm.startPrank(lp);
        usdc.approve(address(vault), 100_000e6);
        vault.deposit(100_000e6, lp);
        vm.stopPrank();

        nvda.mint(address(vault), 2e18);

        // 100k USDC + 2 NVDA * $150 = 100k + 300 = 100,300 USDC (6 decimals)
        assertEq(vault.totalAssets(), 100_300e6);
    }

    function test_RevertWhen_PriceStale() public {
        vm.warp(1 days);

        vm.startPrank(lp);
        usdc.approve(address(vault), 100_000e6);
        vault.deposit(100_000e6, lp);
        vm.stopPrank();

        nvda.mint(address(vault), 1e18);
        nvdaFeed.setUpdatedAt(block.timestamp - 2 hours);

        vm.expectRevert(abi.encodeWithSelector(OracleLib.StalePrice.selector, block.timestamp - 2 hours, 1 hours));
        vault.totalAssets();
    }

    function test_VaultName_ReturnsMandateId() public view {
        assertEq(vault.vaultName(), VAULT_MANDATE);
        assertEq(vault.name(), "AlphaGrid Tech Vault");
    }

    function test_IsAllowedToken_ReflectsEnabledFlag() public {
        assertTrue(vault.isAllowedToken(address(nvda)));

        vm.prank(deployer);
        vault.setTokenEnabled(address(nvda), false);

        assertFalse(vault.isAllowedToken(address(nvda)));
    }

    function test_SetTokenEnabled_DisabledTokenExcludedFromNav() public {
        vm.startPrank(lp);
        usdc.approve(address(vault), 100_000e6);
        vault.deposit(100_000e6, lp);
        vm.stopPrank();

        nvda.mint(address(vault), 2e18);
        assertEq(vault.totalAssets(), 100_300e6);

        vm.prank(deployer);
        vault.setTokenEnabled(address(nvda), false);

        assertEq(vault.totalAssets(), 100_000e6);
    }

    function test_RegistryPriceFeedUpdate_UpdatesVaultNav() public {
        vm.startPrank(lp);
        usdc.approve(address(vault), 100_000e6);
        vault.deposit(100_000e6, lp);
        vm.stopPrank();

        nvda.mint(address(vault), 2e18);

        MockPriceFeed newFeed = new MockPriceFeed(200e8, 8);

        vm.prank(deployer);
        registry.updatePriceFeed(address(nvda), address(newFeed));

        // 100k USDC + 2 NVDA * $200 = 100,400 USDC
        assertEq(vault.totalAssets(), 100_400e6);
    }

    function test_GlobalTokenDeactivation_ExcludedFromNav() public {
        vm.startPrank(lp);
        usdc.approve(address(vault), 100_000e6);
        vault.deposit(100_000e6, lp);
        vm.stopPrank();

        nvda.mint(address(vault), 2e18);

        vm.prank(deployer);
        registry.setTokenActive(address(nvda), false);

        assertFalse(vault.isAllowedToken(address(nvda)));
        assertEq(vault.totalAssets(), 100_000e6);
    }

    function test_TotalAssets_IgnoresStalePriceWhenMaxPriceAgeZero() public {
        vm.warp(30 days);

        vm.prank(deployer);
        vault.setMaxPriceAge(0);

        vm.startPrank(lp);
        usdc.approve(address(vault), 100_000e6);
        vault.deposit(100_000e6, lp);
        vm.stopPrank();

        nvda.mint(address(vault), 1e18);
        nvdaFeed.setUpdatedAt(block.timestamp - 30 days);

        assertEq(vault.totalAssets(), 100_150e6);
    }

    function test_RevertWhen_InvalidPrice() public {
        vm.startPrank(lp);
        usdc.approve(address(vault), 100_000e6);
        vault.deposit(100_000e6, lp);
        vm.stopPrank();

        nvda.mint(address(vault), 1e18);
        nvdaFeed.setPrice(-1);

        vm.expectRevert(OracleLib.InvalidPrice.selector);
        vault.totalAssets();
    }

    function test_RevertWhen_EnableUnregisteredToken() public {
        MockERC20 unlisted = new MockERC20("Unlisted", "UNL", 18);

        vm.expectRevert(abi.encodeWithSelector(MandateVault.TokenNotRegistered.selector, address(unlisted)));
        vm.prank(deployer);
        vault.enableToken(address(unlisted));
    }

    function test_RevertWhen_SetEnabledForUnallowedToken() public {
        MockERC20 unlisted = new MockERC20("Unlisted", "UNL", 18);
        MockPriceFeed feed = new MockPriceFeed(1e8, 8);

        vm.startPrank(deployer);
        registry.registerToken(address(unlisted), address(feed));
        vm.stopPrank();

        vm.expectRevert(abi.encodeWithSelector(MandateVault.TokenNotAllowed.selector, address(unlisted)));
        vm.prank(deployer);
        vault.setTokenEnabled(address(unlisted), true);
    }

    function test_RevertWhen_EnableDuplicateToken() public {
        vm.expectRevert(abi.encodeWithSelector(MandateVault.TokenAlreadyAllowed.selector, address(nvda)));
        vm.prank(deployer);
        vault.enableToken(address(nvda));
    }

    function test_DepositFee_ChargedInUsdc() public {
        vm.prank(deployer);
        vault.setDepositFeeBps(DEPOSIT_FEE_BPS);

        uint256 depositAmount = 100_000e6;
        uint256 expectedFee = (depositAmount * DEPOSIT_FEE_BPS) / 10_000;

        vm.startPrank(lp);
        usdc.approve(address(vault), depositAmount);
        vault.deposit(depositAmount, lp);
        vm.stopPrank();

        assertEq(usdc.balanceOf(feeRecipient), expectedFee);
        assertEq(vault.totalAssets(), depositAmount - expectedFee);
    }

    function test_WithdrawFee_ChargedInUsdc() public {
        vm.startPrank(deployer);
        vault.setWithdrawFeeBps(WITHDRAW_FEE_BPS);
        vm.stopPrank();

        uint256 depositAmount = 100_000e6;

        vm.startPrank(lp);
        usdc.approve(address(vault), depositAmount);
        vault.deposit(depositAmount, lp);

        uint256 withdrawAmount = 50_000e6;
        uint256 expectedFee = (withdrawAmount * WITHDRAW_FEE_BPS) / 10_000;
        vault.withdraw(withdrawAmount, lp, lp);
        vm.stopPrank();

        assertEq(usdc.balanceOf(feeRecipient), expectedFee);
        assertEq(usdc.balanceOf(lp), 1_000_000e6 - depositAmount + withdrawAmount);
    }

    function test_RedeemFee_DeductedFromProceeds() public {
        vm.startPrank(deployer);
        vault.setWithdrawFeeBps(WITHDRAW_FEE_BPS);
        vm.stopPrank();

        vm.startPrank(lp);
        usdc.approve(address(vault), 100_000e6);
        uint256 shares = vault.deposit(100_000e6, lp);

        uint256 expectedNet = vault.previewRedeem(shares);
        uint256 balanceBefore = usdc.balanceOf(lp);
        vault.redeem(shares, lp, lp);
        vm.stopPrank();

        assertEq(usdc.balanceOf(lp) - balanceBefore, expectedNet);
        assertGt(usdc.balanceOf(feeRecipient), 0);
    }

    function test_RevertWhen_SetDepositFeeWithoutRecipient() public {
        MandateVault freshVault = VaultTestLib.deployVault(
            vaultFactory, IERC20(address(usdc)), "Fresh Vault", "agFRESH", VAULT_MANDATE, registry, deployer, address(0)
        );

        vm.expectRevert(MandateVault.FeeRecipientRequired.selector);
        vm.prank(deployer);
        freshVault.setDepositFeeBps(DEPOSIT_FEE_BPS);
    }

    function test_RevertWhen_BpsOutOfRange() public {
        vm.expectRevert(abi.encodeWithSelector(MandateVault.BpsOutOfRange.selector, 10_001));
        vm.prank(deployer);
        vault.setDepositFeeBps(10_001);
    }

    function test_LiquidityPauseBlocksDepositAndWithdraw() public {
        vm.startPrank(lp);
        usdc.approve(address(vault), 100_000e6);
        vault.deposit(100_000e6, lp);
        vm.stopPrank();

        vm.prank(deployer);
        vault.setLiquidityPaused(true);

        vm.startPrank(lp);
        usdc.approve(address(vault), 1000e6);
        vm.expectRevert(MandateVault.LiquidityOperationsPaused.selector);
        vault.deposit(1000e6, lp);

        vm.expectRevert(MandateVault.LiquidityOperationsPaused.selector);
        vault.withdraw(1000e6, lp, lp);
        vm.stopPrank();
    }

    function test_TradingPauseBlocksRoutinePulls() public {
        address router = makeAddr("router");

        vm.startPrank(deployer);
        vault.grantRole(vault.TRADE_ROUTER_ROLE(), router);
        vault.setTradingPaused(true);
        vm.stopPrank();

        vm.prank(router);
        vm.expectRevert(MandateVault.TradingOperationsPaused.selector);
        vault.pullUsdcForTrade(router, 1e6);

        nvda.mint(address(vault), 1e18);

        vm.prank(router);
        vm.expectRevert(MandateVault.TradingOperationsPaused.selector);
        vault.pullTokenForTrade(address(nvda), router, 1e18);
    }

    function test_ForceClosePullBypassesTradingPause() public {
        address router = makeAddr("router");

        vm.startPrank(deployer);
        vault.grantRole(vault.TRADE_ROUTER_ROLE(), router);
        vault.setTradingPaused(true);
        vm.stopPrank();

        nvda.mint(address(vault), 1e18);

        vm.prank(router);
        vault.pullTokenForForceClose(address(nvda), router, 1e18);

        assertEq(nvda.balanceOf(router), 1e18);
    }
}
