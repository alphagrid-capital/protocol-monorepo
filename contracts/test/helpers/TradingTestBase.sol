// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { BaseTest } from "./BaseTest.sol";
import { AgentRegistry } from "../../src/core/AgentRegistry.sol";
import { FeeManager } from "../../src/core/FeeManager.sol";
import { TrackConfig } from "../../src/core/TrackConfig.sol";
import { AllocationManager } from "../../src/core/AllocationManager.sol";
import { TokenRegistry } from "../../src/core/TokenRegistry.sol";
import { PositionManager } from "../../src/core/PositionManager.sol";
import { TradeRouter } from "../../src/core/TradeRouter.sol";
import { MockSwapAdapter } from "../../src/adapters/MockSwapAdapter.sol";
import { AlphaGridVault } from "../../src/vaults/AlphaGridVault.sol";
import { ITrackConfig } from "../../src/interfaces/ITrackConfig.sol";
import { IPositionTypes } from "../../src/interfaces/IPositionTypes.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { MockERC20 } from "../../src/mocks/MockERC20.sol";
import { MockPriceFeed } from "../mocks/MockPriceFeed.sol";

/// @notice Shared fixture: full on-chain stack through TradeRouter with MockSwapAdapter.
abstract contract TradingTestBase is BaseTest {
    bytes32 internal constant VAULT_MANDATE = "TECH";

    uint256 internal constant AGENT_SIGNER_PK = 0xA11CE;
    uint256 internal constant LP_USDC = 1_000_000e6;
    uint256 internal constant CHALLENGE_CAP = 100_000e6;

    AgentRegistry internal registry;
    FeeManager internal feeManager;
    TrackConfig internal trackConfig;
    AllocationManager internal allocationManager;
    TokenRegistry internal tokenRegistry;
    PositionManager internal positionManager;
    TradeRouter internal tradeRouter;
    MockSwapAdapter internal swapAdapter;
    AlphaGridVault internal vault;

    MockERC20 internal nvda;
    MockPriceFeed internal nvdaFeed;

    address internal treasury;
    address internal operator;
    address internal executor;
    address internal lp;
    address internal agentOwner;
    address internal agentSigner;
    address internal vaultAddr;

    function setUpTradingStack() internal {
        treasury = makeAddr("treasury");
        operator = makeAddr("operator");
        executor = makeAddr("executor");
        lp = makeAddr("lp");
        agentOwner = makeAddr("agentOwner");
        agentSigner = vm.addr(AGENT_SIGNER_PK);

        vm.startPrank(deployer);
        feeManager = new FeeManager(deployer, treasury, address(usdc));
        trackConfig = new TrackConfig(deployer);
        tokenRegistry = new TokenRegistry(deployer);
        registry = new AgentRegistry(deployer, feeManager);
        allocationManager = new AllocationManager(deployer, trackConfig);
        positionManager = new PositionManager(deployer);

        vault = new AlphaGridVault(
            IERC20(address(usdc)), "AlphaGrid Tech Vault", "agTECH", VAULT_MANDATE, tokenRegistry, deployer
        );
        vaultAddr = address(vault);

        swapAdapter = new MockSwapAdapter(address(0));
        tradeRouter = new TradeRouter(deployer, registry, allocationManager, positionManager, swapAdapter, trackConfig);
        swapAdapter.setTradeRouter(address(tradeRouter));

        feeManager.setAgentRegistry(address(registry));
        registry.setTrackConfig(trackConfig);
        registry.setAllocationManager(allocationManager);
        allocationManager.setAgentRegistry(address(registry));
        positionManager.setTradeRouter(address(tradeRouter));

        registry.grantRole(registry.OPERATOR_ROLE(), operator);
        registry.grantRole(registry.REGISTRAR_ROLE(), operator);
        tradeRouter.grantRole(tradeRouter.EXECUTOR_ROLE(), executor);
        tradeRouter.grantRole(tradeRouter.OPERATOR_ROLE(), operator);

        vault.grantRole(vault.TRADE_ROUTER_ROLE(), address(tradeRouter));
        allocationManager.grantRole(allocationManager.TRADE_ROUTER_ROLE(), address(tradeRouter));

        vault.setFeeRecipient(treasury);
        vault.setMaxPriceAge(1 hours);
        tradeRouter.setKeeperBounty(50, 100e6);

        nvda = new MockERC20("Mock NVDA", "mNVDA", 18);
        nvdaFeed = new MockPriceFeed(150e8, 8);
        tokenRegistry.registerToken(address(nvda), address(nvdaFeed));
        vault.enableToken(address(nvda));

        _setTrackConfig(vaultAddr, 0, CHALLENGE_CAP, 200_000e6);

        usdc.mint(lp, LP_USDC);
        vm.stopPrank();

        vm.startPrank(lp);
        usdc.approve(vaultAddr, LP_USDC);
        vault.deposit(LP_USDC, lp);
        vm.stopPrank();
    }

    function _registerAgent() internal returns (uint256 agentId) {
        vm.prank(operator);
        agentId = registry.registerAgent(agentOwner, vaultAddr, "Bot", "ipfs://bot", agentSigner);
    }

    function _singleStopIntent(uint256 agentId, uint256 usdcAmount, int256 stopBps)
        internal
        pure
        returns (IPositionTypes.PositionIntent memory intent)
    {
        IPositionTypes.ExitRule[] memory exits = new IPositionTypes.ExitRule[](1);
        exits[0] = IPositionTypes.ExitRule({
            triggerType: IPositionTypes.TriggerType.StopLoss, triggerBps: stopBps, exitBps: 10_000
        });

        intent = IPositionTypes.PositionIntent({
            agentId: agentId,
            vault: address(0),
            token: address(0),
            usdcAmount: usdcAmount,
            minTokenOut: 0,
            maxSlippageBps: 100,
            exits: exits,
            deadline: 0,
            nonce: 0
        });
    }

    function _signOpenPosition(IPositionTypes.PositionIntent memory intent) internal view returns (bytes memory) {
        intent.vault = vaultAddr;
        intent.token = address(nvda);
        intent.deadline = block.timestamp + 1 hours;
        intent.nonce = tradeRouter.nonces(intent.agentId);

        bytes32 exitsHash = _hashExitRules(intent.exits);
        bytes32 structHash = keccak256(
            abi.encode(
                tradeRouter.OPEN_POSITION_TYPEHASH(),
                intent.agentId,
                intent.vault,
                intent.token,
                intent.usdcAmount,
                intent.minTokenOut,
                intent.maxSlippageBps,
                exitsHash,
                intent.deadline,
                intent.nonce
            )
        );

        bytes32 digest = MessageHashUtils.toTypedDataHash(_routerDomainSeparator(), structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(AGENT_SIGNER_PK, digest);
        return abi.encodePacked(r, s, v);
    }

    function _hashExitRules(IPositionTypes.ExitRule[] memory exits) internal pure returns (bytes32) {
        uint256 len = exits.length;
        bytes32[] memory hashes = new bytes32[](len);
        for (uint256 i = 0; i < len; i++) {
            hashes[i] = keccak256(abi.encode(exits[i].triggerType, exits[i].triggerBps, exits[i].exitBps));
        }
        return keccak256(abi.encode(hashes));
    }

    function _routerDomainSeparator() internal view returns (bytes32) {
        (,, string memory version, uint256 chainId, address verifyingContract,,) = tradeRouter.eip712Domain();
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("AlphaGrid TradeRouter")),
                keccak256(bytes(version)),
                chainId,
                verifyingContract
            )
        );
    }

    function _setTrackConfig(address vault_, uint256 trackId, uint256 initialAllocation, uint256 maxAllocation)
        internal
    {
        trackConfig.setVaultTrackConfig(
            vault_,
            trackId,
            ITrackConfig.VaultTrackConfig({
                vault: vault_,
                trackId: trackId,
                initialAllocation: initialAllocation,
                maxAllocation: maxAllocation,
                maxDrawdownBps: 1500,
                maxTradeSizeBps: 5000,
                maxDailyTurnoverBps: 2500,
                evaluationPeriod: 14 days,
                minTrades: 5,
                promotionScore: 70,
                active: true
            })
        );
    }
}
