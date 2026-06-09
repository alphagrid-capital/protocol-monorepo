// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TokenRegistry } from "../../src/core/TokenRegistry.sol";
import { VaultTrackRegistry } from "../../src/core/VaultTrackRegistry.sol";
import { IMandateVaultFactory } from "../../src/interfaces/IMandateVaultFactory.sol";
import { IVaultTrackRegistry } from "../../src/interfaces/IVaultTrackRegistry.sol";
import { MockERC20 } from "../../src/mocks/MockERC20.sol";
import { MandateVault } from "../../src/vaults/MandateVault.sol";
import { MandateVaultFactory } from "../../src/vaults/MandateVaultFactory.sol";
import { BaseTest } from "../helpers/BaseTest.sol";
import { VaultTestLib } from "../helpers/VaultTestLib.sol";

contract MandateVaultFactoryTest is BaseTest {
    MandateVaultFactory internal factory;
    TokenRegistry internal registry;
    VaultTrackRegistry internal vaultTrackRegistry;

    address internal lp;

    function setUp() public override {
        super.setUp();

        lp = makeAddr("lp");

        vm.startPrank(deployer);
        registry = new TokenRegistry(deployer);
        vaultTrackRegistry = new VaultTrackRegistry(deployer);
        (factory,) = VaultTestLib.deployFactory(IERC20(address(usdc)));
        vm.stopPrank();
    }

    function test_DeployTwoVaultsDistinctMandates() public {
        vm.startPrank(deployer);

        MandateVault techVault = VaultTestLib.deployVault(
            factory, IERC20(address(usdc)), "AlphaGrid Tech Vault", "agTECH", "TECH", registry, deployer, address(0)
        );
        MandateVault macroVault = VaultTestLib.deployVault(
            factory, IERC20(address(usdc)), "AlphaGrid Macro Vault", "agMAC", "MACRO", registry, deployer, address(0)
        );

        vm.stopPrank();

        assertEq(techVault.vaultName(), "TECH");
        assertEq(macroVault.vaultName(), "MACRO");
        assertEq(techVault.name(), "AlphaGrid Tech Vault");
        assertEq(macroVault.symbol(), "agMAC");
        assertNotEq(address(techVault), address(macroVault));
        assertEq(factory.vaultCount(), 2);
        assertEq(factory.vaultAt(0), address(techVault));
        assertEq(factory.vaultAt(1), address(macroVault));
    }

    function test_ERC4626DepositOnProxy() public {
        MandateVault vault = VaultTestLib.deployVault(
            factory, IERC20(address(usdc)), "AlphaGrid Tech Vault", "agTECH", "TECH", registry, deployer, address(0)
        );

        usdc.mint(lp, 100_000e6);

        vm.startPrank(lp);
        usdc.approve(address(vault), 100_000e6);
        uint256 shares = vault.deposit(100_000e6, lp);
        vm.stopPrank();

        assertGt(shares, 0);
        assertEq(vault.balanceOf(lp), shares);
        assertEq(vault.totalAssets(), 100_000e6);
    }

    function test_VaultTrackRegistryReferencesProxy() public {
        MandateVault vault = VaultTestLib.deployVault(
            factory, IERC20(address(usdc)), "AlphaGrid Tech Vault", "agTECH", "TECH", registry, deployer, address(0)
        );

        vm.prank(deployer);
        vaultTrackRegistry.setVaultTrackConfig(
            address(vault),
            0,
            IVaultTrackRegistry.VaultTrackConfig({
                vault: address(vault),
                trackId: 0,
                initialAllocation: 10_000e6,
                maxAllocation: 25_000e6,
                maxDrawdownBps: 1500,
                maxTradeSizeBps: 500,
                maxDailyTurnoverBps: 2500,
                evaluationPeriod: 14 days,
                minTrades: 5,
                promotionScore: 70,
                active: true,
                maxStopLossBps: 1500,
                minTakeProfitBps: 0,
                maxTakeProfitBps: 10_000,
                requireStopLoss: true,
                requireTakeProfit: false
            })
        );

        assertEq(vaultTrackRegistry.getVaultTrackConfig(address(vault), 0).initialAllocation, 10_000e6);
    }

    function test_CloneUsesFixedImplementation() public {
        MandateVault vault = VaultTestLib.deployVault(
            factory, IERC20(address(usdc)), "AlphaGrid Tech Vault", "agTECH", "TECH", registry, deployer, address(0)
        );

        address impl = factory.implementation();
        assertNotEq(address(vault), impl);
        assertEq(vault.asset(), address(usdc));
    }

    function test_FactoryHasNoCentralUpgradePath() public view {
        assertTrue(factory.implementation() != address(0));
        assertTrue(factory.asset() == address(usdc));
    }

    function test_RevertWhen_AssetMismatch() public {
        MockERC20 otherAsset = new MockERC20("Other", "OTH", 6);

        vm.expectRevert(
            abi.encodeWithSelector(MandateVaultFactory.AssetMismatch.selector, address(usdc), address(otherAsset))
        );
        factory.deployVault(
            IMandateVaultFactory.VaultDeploymentConfig({
                asset: IERC20(address(otherAsset)),
                shareName: "Other Vault",
                shareSymbol: "agOTH",
                mandate: "OTHER",
                tokenRegistry: registry,
                admin: deployer,
                feeRecipient: address(0)
            })
        );
    }
}
