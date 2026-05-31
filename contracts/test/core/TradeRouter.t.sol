// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Phase3Base } from "../helpers/Phase3Base.sol";
import { TradeRouter } from "../../src/core/TradeRouter.sol";
import { IAgentRegistry } from "../../src/interfaces/IAgentRegistry.sol";
import { ITrackConfig } from "../../src/interfaces/ITrackConfig.sol";
import { IPositionTypes } from "../../src/interfaces/IPositionTypes.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TradeRouterTest is Phase3Base {
    function setUp() public override {
        super.setUp();
        setUpPhase3();
    }

    function test_OpenAndKeeperExit() public {
        uint256 agentId = _registerAgent();
        uint256 usdcAmount = 10_000e6;

        IPositionTypes.PositionIntent memory intent = _singleStopIntent(agentId, usdcAmount, -1000);
        bytes memory sig = _signOpenPosition(intent);

        vm.prank(executor);
        uint256 positionId = tradeRouter.openPosition(intent, sig);

        assertEq(allocationManager.allocationUsed(agentId), usdcAmount);
        assertGt(positionManager.getPosition(positionId).tokenAmount, 0);
        assertEq(positionManager.totalTokenLedger(address(nvda)), IERC20(address(nvda)).balanceOf(vaultAddr));

        nvdaFeed.setPrice(120e8);

        address keeper = makeAddr("keeper");
        uint256 keeperBefore = usdc.balanceOf(keeper);

        vm.prank(keeper);
        tradeRouter.executeExit(positionId);

        assertEq(positionManager.getPosition(positionId).tokenAmount, 0);
        assertEq(allocationManager.allocationUsed(agentId), 0);
        assertGt(usdc.balanceOf(keeper), keeperBefore);
    }

    function test_RevertWhen_OpenWithoutExecutor() public {
        uint256 agentId = _registerAgent();
        IPositionTypes.PositionIntent memory intent = _singleStopIntent(agentId, 1000e6, -1000);
        bytes memory sig = _signOpenPosition(intent);

        vm.expectRevert();
        vm.prank(alice);
        tradeRouter.openPosition(intent, sig);
    }

    function test_RevertWhen_ExitTriggerNotMet() public {
        uint256 agentId = _registerAgent();
        IPositionTypes.PositionIntent memory intent = _singleStopIntent(agentId, 5000e6, -1000);
        bytes memory sig = _signOpenPosition(intent);

        vm.prank(executor);
        uint256 positionId = tradeRouter.openPosition(intent, sig);

        vm.expectRevert(abi.encodeWithSelector(TradeRouter.TriggerNotMet.selector, positionId));
        tradeRouter.executeExit(positionId);
    }

    function test_IsTriggerMet() public {
        uint256 agentId = _registerAgent();
        IPositionTypes.PositionIntent memory intent = _singleStopIntent(agentId, 5000e6, -1000);
        bytes memory sig = _signOpenPosition(intent);

        vm.prank(executor);
        uint256 positionId = tradeRouter.openPosition(intent, sig);

        assertFalse(tradeRouter.isTriggerMet(positionId));

        nvdaFeed.setPrice(130e8);
        assertTrue(tradeRouter.isTriggerMet(positionId));
    }

    function test_RevertWhen_InvalidExitRules_LastNotFull() public {
        uint256 agentId = _registerAgent();

        IPositionTypes.ExitRule[] memory exits = new IPositionTypes.ExitRule[](1);
        exits[0] = IPositionTypes.ExitRule({
            triggerType: IPositionTypes.TriggerType.StopLoss, triggerBps: -1000, exitBps: 5000
        });

        IPositionTypes.PositionIntent memory intent = IPositionTypes.PositionIntent({
            agentId: agentId,
            vault: vaultAddr,
            token: address(nvda),
            usdcAmount: 1000e6,
            minTokenOut: 0,
            maxSlippageBps: 100,
            exits: exits,
            deadline: block.timestamp + 1 hours,
            nonce: 0
        });
        bytes memory sig = _signOpenPosition(intent);

        vm.expectRevert(TradeRouter.InvalidExitRules.selector);
        vm.prank(executor);
        tradeRouter.openPosition(intent, sig);
    }

    function test_RevertWhen_InvalidKeeperBountyBps() public {
        vm.expectRevert(abi.encodeWithSelector(TradeRouter.BpsOutOfRange.selector, 10_001));
        vm.prank(deployer);
        tradeRouter.setKeeperBounty(10_001, 0);
    }

    function test_RevertWhen_ForceCloseWithoutOperator() public {
        uint256 agentId = _registerAgent();
        IPositionTypes.PositionIntent memory intent = _singleStopIntent(agentId, 2000e6, -1000);
        bytes memory sig = _signOpenPosition(intent);

        vm.prank(executor);
        uint256 positionId = tradeRouter.openPosition(intent, sig);

        vm.prank(operator);
        registry.setAgentStatus(agentId, IAgentRegistry.AgentStatus.Suspended);

        vm.expectRevert();
        vm.prank(alice);
        tradeRouter.forceClose(positionId);
    }

    function test_RevertWhen_ExceedsMaxTradeSize() public {
        uint256 agentId = _registerAgent();
        IPositionTypes.PositionIntent memory intent = _singleStopIntent(agentId, LP_USDC, -1000);
        bytes memory sig = _signOpenPosition(intent);

        uint256 maxTrade = (LP_USDC * 5000) / 10_000;
        vm.expectRevert(abi.encodeWithSelector(TradeRouter.ExceedsMaxTradeSize.selector, LP_USDC, maxTrade));
        vm.prank(executor);
        tradeRouter.openPosition(intent, sig);
    }

    function test_RevertWhen_OpenWhileRegistryPaused() public {
        uint256 agentId = _registerAgent();
        IPositionTypes.PositionIntent memory intent = _singleStopIntent(agentId, 1000e6, -1000);
        bytes memory sig = _signOpenPosition(intent);

        vm.prank(operator);
        registry.pause();

        vm.expectRevert(TradeRouter.RegistryPaused.selector);
        vm.prank(executor);
        tradeRouter.openPosition(intent, sig);
    }

    function test_ExecuteExitStillWorksWhenRegistryPaused() public {
        uint256 agentId = _registerAgent();
        IPositionTypes.PositionIntent memory intent = _singleStopIntent(agentId, 5000e6, -1000);
        bytes memory sig = _signOpenPosition(intent);

        vm.prank(executor);
        uint256 positionId = tradeRouter.openPosition(intent, sig);

        vm.prank(operator);
        registry.pause();

        nvdaFeed.setPrice(120e8);
        vm.prank(makeAddr("keeper"));
        tradeRouter.executeExit(positionId);

        assertEq(positionManager.getPosition(positionId).tokenAmount, 0);
    }

    function test_RevertWhen_OpenOnInactiveVaultTrack() public {
        uint256 agentId = _registerAgent();

        vm.prank(deployer);
        trackConfig.setVaultTrackConfig(
            vaultAddr,
            0,
            ITrackConfig.VaultTrackConfig({
                vault: vaultAddr,
                trackId: 0,
                initialAllocation: CHALLENGE_CAP,
                maxAllocation: 200_000e6,
                maxDrawdownBps: 1500,
                maxTradeSizeBps: 5000,
                maxDailyTurnoverBps: 2500,
                evaluationPeriod: 14 days,
                minTrades: 5,
                promotionScore: 70,
                active: false
            })
        );

        IPositionTypes.PositionIntent memory intent = _singleStopIntent(agentId, 1000e6, -1000);
        bytes memory sig = _signOpenPosition(intent);

        vm.expectRevert(abi.encodeWithSelector(TradeRouter.VaultTrackNotActive.selector, vaultAddr, 0));
        vm.prank(executor);
        tradeRouter.openPosition(intent, sig);
    }

    function test_RevertWhen_ExceedsDailyTurnover() public {
        uint256 agentId = _registerAgent();

        vm.prank(deployer);
        trackConfig.setVaultTrackConfig(
            vaultAddr,
            0,
            ITrackConfig.VaultTrackConfig({
                vault: vaultAddr,
                trackId: 0,
                initialAllocation: CHALLENGE_CAP,
                maxAllocation: 200_000e6,
                maxDrawdownBps: 1500,
                maxTradeSizeBps: 5000,
                maxDailyTurnoverBps: 500,
                evaluationPeriod: 14 days,
                minTrades: 5,
                promotionScore: 70,
                active: true
            })
        );

        uint256 maxDaily = (LP_USDC * 500) / 10_000;
        IPositionTypes.PositionIntent memory intent = _singleStopIntent(agentId, maxDaily + 1, -1000);
        bytes memory sig = _signOpenPosition(intent);

        vm.expectRevert(
            abi.encodeWithSelector(TradeRouter.ExceedsDailyTurnover.selector, agentId, maxDaily + 1, maxDaily)
        );
        vm.prank(executor);
        tradeRouter.openPosition(intent, sig);
    }
}
