// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { VaultTrackRegistry } from "../../src/core/VaultTrackRegistry.sol";
import { IVaultTrackRegistry } from "../../src/interfaces/IVaultTrackRegistry.sol";
import { BaseTest } from "../helpers/BaseTest.sol";

contract VaultTrackRegistryTest is BaseTest {
    VaultTrackRegistry internal vaultTrackRegistry;

    address internal vault;
    address internal vaultB;
    address internal configAdmin;

    function setUp() public override {
        super.setUp();

        vault = makeAddr("vault");
        vaultB = makeAddr("vaultB");
        configAdmin = makeAddr("configAdmin");

        vm.startPrank(deployer);
        vaultTrackRegistry = new VaultTrackRegistry(deployer);
        vaultTrackRegistry.grantRole(vaultTrackRegistry.CONFIG_ADMIN_ROLE(), configAdmin);
        vm.stopPrank();
    }

    function test_TrackTypesInitialized() public view {
        IVaultTrackRegistry.TrackType memory challenge = vaultTrackRegistry.getTrackType(0);
        assertEq(challenge.trackId, 0);
        assertEq(challenge.name, "CHALLENGE");
        assertEq(uint256(challenge.capitalMode), uint256(IVaultTrackRegistry.CapitalMode.Simulated));
        assertTrue(challenge.active);

        IVaultTrackRegistry.TrackType memory funded = vaultTrackRegistry.getTrackType(1);
        assertEq(funded.trackId, 1);
        assertEq(funded.name, "FUNDED");
        assertEq(uint256(funded.capitalMode), uint256(IVaultTrackRegistry.CapitalMode.Real));
        assertTrue(funded.active);

        IVaultTrackRegistry.TrackType memory prime = vaultTrackRegistry.getTrackType(2);
        assertEq(prime.trackId, 2);
        assertEq(prime.name, "PRIME");
        assertEq(uint256(prime.capitalMode), uint256(IVaultTrackRegistry.CapitalMode.Real));
        assertTrue(prime.active);
    }

    function test_SetAndGetVaultTrackConfig() public {
        IVaultTrackRegistry.VaultTrackConfig memory config = _sampleConfig(vault, 0, true);

        vm.prank(configAdmin);
        vaultTrackRegistry.setVaultTrackConfig(vault, 0, config);

        IVaultTrackRegistry.VaultTrackConfig memory stored = vaultTrackRegistry.getVaultTrackConfig(vault, 0);
        assertEq(stored.vault, vault);
        assertEq(stored.trackId, 0);
        assertEq(stored.initialAllocation, config.initialAllocation);
        assertEq(stored.maxAllocation, config.maxAllocation);
        assertEq(stored.maxDrawdownBps, config.maxDrawdownBps);
        assertEq(stored.maxTradeSizeBps, config.maxTradeSizeBps);
        assertEq(stored.maxDailyTurnoverBps, config.maxDailyTurnoverBps);
        assertEq(stored.evaluationPeriod, config.evaluationPeriod);
        assertEq(stored.minTrades, config.minTrades);
        assertEq(stored.promotionScore, config.promotionScore);
        assertTrue(stored.active);
    }

    function test_IsVaultTrackActive() public {
        assertFalse(vaultTrackRegistry.isVaultTrackActive(vault, 0));

        vm.prank(configAdmin);
        vaultTrackRegistry.setVaultTrackConfig(vault, 0, _sampleConfig(vault, 0, true));
        assertTrue(vaultTrackRegistry.isVaultTrackActive(vault, 0));

        vm.prank(configAdmin);
        vaultTrackRegistry.setVaultTrackConfig(vault, 0, _sampleConfig(vault, 0, false));
        assertFalse(vaultTrackRegistry.isVaultTrackActive(vault, 0));
    }

    function test_CapitalModeOf() public view {
        assertEq(
            uint256(vaultTrackRegistry.capitalModeOf(vault, 0)), uint256(IVaultTrackRegistry.CapitalMode.Simulated)
        );
        assertEq(uint256(vaultTrackRegistry.capitalModeOf(vault, 1)), uint256(IVaultTrackRegistry.CapitalMode.Real));
        assertEq(uint256(vaultTrackRegistry.capitalModeOf(vault, 2)), uint256(IVaultTrackRegistry.CapitalMode.Real));
    }

    function test_RevertWhen_InvalidTrackId() public {
        vm.expectRevert(abi.encodeWithSelector(VaultTrackRegistry.InvalidTrackId.selector, 3));
        vaultTrackRegistry.getTrackType(3);

        vm.prank(configAdmin);
        vm.expectRevert(abi.encodeWithSelector(VaultTrackRegistry.InvalidTrackId.selector, 3));
        vaultTrackRegistry.setVaultTrackConfig(vault, 3, _sampleConfig(vault, 3, true));
    }

    function test_RevertWhen_ZeroVault() public {
        vm.prank(configAdmin);
        vm.expectRevert(VaultTrackRegistry.ZeroAddress.selector);
        vaultTrackRegistry.setVaultTrackConfig(address(0), 0, _sampleConfig(vault, 0, true));
    }

    function test_RevertWhen_BpsOutOfRange() public {
        IVaultTrackRegistry.VaultTrackConfig memory config = _sampleConfig(vault, 0, true);
        config.maxDrawdownBps = 10_001;

        vm.prank(configAdmin);
        vm.expectRevert(abi.encodeWithSelector(VaultTrackRegistry.BpsOutOfRange.selector, 10_001));
        vaultTrackRegistry.setVaultTrackConfig(vault, 0, config);
    }

    function test_RevertWhen_AllocationOutOfRange() public {
        IVaultTrackRegistry.VaultTrackConfig memory config = _sampleConfig(vault, 0, true);
        config.initialAllocation = 200;
        config.maxAllocation = 100;

        vm.prank(configAdmin);
        vm.expectRevert(abi.encodeWithSelector(VaultTrackRegistry.AllocationOutOfRange.selector, 200, 100));
        vaultTrackRegistry.setVaultTrackConfig(vault, 0, config);
    }

    function test_RevertWhen_SetConfigWithoutRole() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, bob, vaultTrackRegistry.CONFIG_ADMIN_ROLE()
            )
        );
        vm.prank(bob);
        vaultTrackRegistry.setVaultTrackConfig(vault, 0, _sampleConfig(vault, 0, true));
    }

    function test_AutoRegistersVaultOnFirstSetVaultTrackConfig() public {
        assertEq(vaultTrackRegistry.vaultCount(), 0);
        assertFalse(vaultTrackRegistry.isRegisteredVault(vault));

        vm.expectEmit();
        emit IVaultTrackRegistry.VaultRegistered(vault);

        vm.prank(configAdmin);
        vaultTrackRegistry.setVaultTrackConfig(vault, 0, _sampleConfig(vault, 0, true));

        assertEq(vaultTrackRegistry.vaultCount(), 1);
        assertTrue(vaultTrackRegistry.isRegisteredVault(vault));
        assertEq(vaultTrackRegistry.vaultAt(0), vault);
    }

    function test_AutoRegistersOnFirstConfigAnyTrack() public {
        vm.prank(configAdmin);
        vaultTrackRegistry.setVaultTrackConfig(vault, 1, _sampleConfig(vault, 1, true));

        assertEq(vaultTrackRegistry.vaultCount(), 1);
        assertTrue(vaultTrackRegistry.isRegisteredVault(vault));
        assertEq(vaultTrackRegistry.vaultAt(0), vault);
    }

    function test_NoDuplicateRegistration() public {
        vm.startPrank(configAdmin);
        vaultTrackRegistry.setVaultTrackConfig(vault, 0, _sampleConfig(vault, 0, true));
        vaultTrackRegistry.setVaultTrackConfig(vault, 1, _sampleConfig(vault, 1, true));
        vm.stopPrank();

        assertEq(vaultTrackRegistry.vaultCount(), 1);
        assertEq(vaultTrackRegistry.vaultAt(0), vault);
    }

    function test_EnumerationOrderMatchesRegistrationOrder() public {
        vm.prank(configAdmin);
        vaultTrackRegistry.setVaultTrackConfig(vault, 0, _sampleConfig(vault, 0, true));

        vm.prank(configAdmin);
        vaultTrackRegistry.setVaultTrackConfig(vaultB, 0, _sampleConfig(vaultB, 0, true));

        assertEq(vaultTrackRegistry.vaultCount(), 2);
        assertEq(vaultTrackRegistry.vaultAt(0), vault);
        assertEq(vaultTrackRegistry.vaultAt(1), vaultB);
        assertTrue(vaultTrackRegistry.isRegisteredVault(vault));
        assertTrue(vaultTrackRegistry.isRegisteredVault(vaultB));
    }

    function _sampleConfig(address vault_, uint256 trackId_, bool active)
        internal
        pure
        returns (IVaultTrackRegistry.VaultTrackConfig memory)
    {
        return IVaultTrackRegistry.VaultTrackConfig({
            vault: vault_,
            trackId: trackId_,
            initialAllocation: 10_000e6,
            maxAllocation: 50_000e6,
            maxDrawdownBps: 1000,
            maxTradeSizeBps: 500,
            maxDailyTurnoverBps: 2000,
            maxDailyLossBps: 0,
            evaluationPeriod: 30 days,
            minTrades: 10,
            promotionScore: 75,
            active: active,
            maxStopLossBps: 1500,
            minTakeProfitBps: 0,
            maxTakeProfitBps: 10_000,
            requireStopLoss: true,
            requireTakeProfit: false
        });
    }
}
