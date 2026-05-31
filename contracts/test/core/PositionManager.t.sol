// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Phase3Base } from "../helpers/Phase3Base.sol";
import { PositionManager } from "../../src/core/PositionManager.sol";
import { IPositionTypes } from "../../src/interfaces/IPositionTypes.sol";

contract PositionManagerTest is Phase3Base {
    function setUp() public override {
        super.setUp();
        setUpPhase3();
    }

    function test_OpenPositionCreditsLedger() public {
        IPositionTypes.ExitRule[] memory exits = new IPositionTypes.ExitRule[](1);
        exits[0] = IPositionTypes.ExitRule({
            triggerType: IPositionTypes.TriggerType.StopLoss, triggerBps: -1000, exitBps: 10_000
        });

        vm.prank(address(tradeRouter));
        uint256 positionId = positionManager.openPosition(1, vaultAddr, address(nvda), 1e18, 150e6, 1000e6, 100, exits);

        assertEq(positionId, 1);
        assertEq(positionManager.agentTokenBalance(1, address(nvda)), 1e18);
        assertEq(positionManager.totalTokenLedger(address(nvda)), 1e18);
        assertEq(positionManager.openPositionId(1, address(nvda)), positionId);

        IPositionTypes.Position memory position = positionManager.getPosition(positionId);
        assertEq(position.tokenAmount, 1e18);
        assertEq(position.usdcCostBasis, 1000e6);
        assertEq(uint256(position.status), uint256(IPositionTypes.PositionStatus.Open));
    }

    function test_ApplyExitPartialAndClose() public {
        IPositionTypes.ExitRule[] memory exits = new IPositionTypes.ExitRule[](2);
        exits[0] = IPositionTypes.ExitRule({
            triggerType: IPositionTypes.TriggerType.StopLoss, triggerBps: -1000, exitBps: 5000
        });
        exits[1] = IPositionTypes.ExitRule({
            triggerType: IPositionTypes.TriggerType.StopLoss, triggerBps: -2000, exitBps: 10_000
        });

        vm.startPrank(address(tradeRouter));
        uint256 positionId = positionManager.openPosition(1, vaultAddr, address(nvda), 2e18, 150e6, 2000e6, 100, exits);
        positionManager.applyExit(positionId, 1e18, 1000e6);
        vm.stopPrank();

        assertEq(positionManager.agentTokenBalance(1, address(nvda)), 1e18);

        vm.prank(address(tradeRouter));
        positionManager.applyExit(positionId, 1e18, 1000e6);

        assertEq(positionManager.agentTokenBalance(1, address(nvda)), 0);
        assertEq(positionManager.totalTokenLedger(address(nvda)), 0);
        assertEq(positionManager.openPositionId(1, address(nvda)), 0);
        assertEq(uint256(positionManager.getPosition(positionId).status), uint256(IPositionTypes.PositionStatus.Closed));
    }

    function test_RevertWhen_NotTradeRouter() public {
        vm.expectRevert(abi.encodeWithSelector(PositionManager.NotTradeRouter.selector, alice));
        vm.prank(alice);
        positionManager.openPosition(
            1, vaultAddr, address(nvda), 1e18, 150e6, 1000e6, 100, new IPositionTypes.ExitRule[](0)
        );
    }
}
