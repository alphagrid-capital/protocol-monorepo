// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { BaseTest } from "../helpers/BaseTest.sol";
import { TrackConfig } from "../../src/core/TrackConfig.sol";
import { ITrackConfig } from "../../src/interfaces/ITrackConfig.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

contract TrackConfigTest is BaseTest {
    TrackConfig internal trackConfig;

    address internal vault;
    address internal configAdmin;

    function setUp() public override {
        super.setUp();

        vault = makeAddr("vault");
        configAdmin = makeAddr("configAdmin");

        vm.startPrank(deployer);
        trackConfig = new TrackConfig(deployer);
        trackConfig.grantRole(trackConfig.CONFIG_ADMIN_ROLE(), configAdmin);
        vm.stopPrank();
    }

    function test_TrackTypesInitialized() public view {
        ITrackConfig.TrackType memory challenge = trackConfig.getTrackType(0);
        assertEq(challenge.trackId, 0);
        assertEq(challenge.name, "CHALLENGE");
        assertEq(uint256(challenge.capitalMode), uint256(ITrackConfig.CapitalMode.Simulated));
        assertTrue(challenge.active);

        ITrackConfig.TrackType memory funded = trackConfig.getTrackType(1);
        assertEq(funded.trackId, 1);
        assertEq(funded.name, "FUNDED");
        assertEq(uint256(funded.capitalMode), uint256(ITrackConfig.CapitalMode.Real));
        assertTrue(funded.active);

        ITrackConfig.TrackType memory prime = trackConfig.getTrackType(2);
        assertEq(prime.trackId, 2);
        assertEq(prime.name, "PRIME");
        assertEq(uint256(prime.capitalMode), uint256(ITrackConfig.CapitalMode.Real));
        assertTrue(prime.active);
    }

    function test_SetAndGetVaultTrackConfig() public {
        ITrackConfig.VaultTrackConfig memory config = _sampleConfig(true);

        vm.prank(configAdmin);
        trackConfig.setVaultTrackConfig(vault, 0, config);

        ITrackConfig.VaultTrackConfig memory stored = trackConfig.getVaultTrackConfig(vault, 0);
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
        assertFalse(trackConfig.isVaultTrackActive(vault, 0));

        vm.prank(configAdmin);
        trackConfig.setVaultTrackConfig(vault, 0, _sampleConfig(true));
        assertTrue(trackConfig.isVaultTrackActive(vault, 0));

        vm.prank(configAdmin);
        trackConfig.setVaultTrackConfig(vault, 0, _sampleConfig(false));
        assertFalse(trackConfig.isVaultTrackActive(vault, 0));
    }

    function test_CapitalModeOf() public view {
        assertEq(uint256(trackConfig.capitalModeOf(vault, 0)), uint256(ITrackConfig.CapitalMode.Simulated));
        assertEq(uint256(trackConfig.capitalModeOf(vault, 1)), uint256(ITrackConfig.CapitalMode.Real));
        assertEq(uint256(trackConfig.capitalModeOf(vault, 2)), uint256(ITrackConfig.CapitalMode.Real));
    }

    function test_RevertWhen_InvalidTrackId() public {
        vm.expectRevert(abi.encodeWithSelector(TrackConfig.InvalidTrackId.selector, 3));
        trackConfig.getTrackType(3);

        vm.prank(configAdmin);
        vm.expectRevert(abi.encodeWithSelector(TrackConfig.InvalidTrackId.selector, 3));
        trackConfig.setVaultTrackConfig(vault, 3, _sampleConfig(true));
    }

    function test_RevertWhen_ZeroVault() public {
        vm.prank(configAdmin);
        vm.expectRevert(TrackConfig.ZeroAddress.selector);
        trackConfig.setVaultTrackConfig(address(0), 0, _sampleConfig(true));
    }

    function test_RevertWhen_BpsOutOfRange() public {
        ITrackConfig.VaultTrackConfig memory config = _sampleConfig(true);
        config.maxDrawdownBps = 10_001;

        vm.prank(configAdmin);
        vm.expectRevert(abi.encodeWithSelector(TrackConfig.BpsOutOfRange.selector, 10_001));
        trackConfig.setVaultTrackConfig(vault, 0, config);
    }

    function test_RevertWhen_AllocationOutOfRange() public {
        ITrackConfig.VaultTrackConfig memory config = _sampleConfig(true);
        config.initialAllocation = 200;
        config.maxAllocation = 100;

        vm.prank(configAdmin);
        vm.expectRevert(abi.encodeWithSelector(TrackConfig.AllocationOutOfRange.selector, 200, 100));
        trackConfig.setVaultTrackConfig(vault, 0, config);
    }

    function test_RevertWhen_SetConfigWithoutRole() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, bob, trackConfig.CONFIG_ADMIN_ROLE()
            )
        );
        vm.prank(bob);
        trackConfig.setVaultTrackConfig(vault, 0, _sampleConfig(true));
    }

    function _sampleConfig(bool active) internal view returns (ITrackConfig.VaultTrackConfig memory) {
        return ITrackConfig.VaultTrackConfig({
            vault: vault,
            trackId: 0,
            initialAllocation: 10_000e6,
            maxAllocation: 50_000e6,
            maxDrawdownBps: 1000,
            maxTradeSizeBps: 500,
            maxDailyTurnoverBps: 2000,
            evaluationPeriod: 30 days,
            minTrades: 10,
            promotionScore: 75,
            active: active
        });
    }
}
