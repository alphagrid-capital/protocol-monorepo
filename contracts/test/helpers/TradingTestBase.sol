// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import { MockSwapAdapter } from "../../src/adapters/MockSwapAdapter.sol";
import { AgentRegistry } from "../../src/core/AgentRegistry.sol";
import { AllocationManager } from "../../src/core/AllocationManager.sol";
import { FeeManager } from "../../src/core/FeeManager.sol";
import { PositionManager } from "../../src/core/PositionManager.sol";
import { TokenRegistry } from "../../src/core/TokenRegistry.sol";
import { TradeRouter } from "../../src/core/TradeRouter.sol";
import { TradeRouterLens } from "../../src/core/TradeRouterLens.sol";
import { VaultTrackRegistry } from "../../src/core/VaultTrackRegistry.sol";
import { IPositionTypes } from "../../src/interfaces/IPositionTypes.sol";
import { IVaultTrackRegistry } from "../../src/interfaces/IVaultTrackRegistry.sol";
import { MockERC20 } from "../../src/mocks/MockERC20.sol";
import { MandateVault } from "../../src/vaults/MandateVault.sol";
import { MandateVaultFactory } from "../../src/vaults/MandateVaultFactory.sol";
import { MockPriceOracle } from "../../src/mocks/MockPriceOracle.sol";
import { AgentTestLib } from "./AgentTestLib.sol";
import { BaseTest } from "./BaseTest.sol";
import { MockERC8004IdentityRegistry } from "../mocks/MockERC8004IdentityRegistry.sol";
import { VaultTestLib } from "./VaultTestLib.sol";

/// @notice Shared fixture: full on-chain stack through TradeRouter with MockSwapAdapter.
abstract contract TradingTestBase is BaseTest {
    bytes32 internal constant VAULT_MANDATE = "TECH";

    uint256 internal constant AGENT_SIGNER_PK = 0xA11CE;
    uint256 internal constant LP_USDC = 1_000_000e6;
    uint256 internal constant CHALLENGE_CAP = 100_000e6;

    AgentRegistry internal registry;
    FeeManager internal feeManager;
    VaultTrackRegistry internal vaultTrackRegistry;
    AllocationManager internal allocationManager;
    TokenRegistry internal tokenRegistry;
    PositionManager internal positionManager;
    TradeRouter internal tradeRouter;
    TradeRouterLens internal tradeRouterLens;
    MockSwapAdapter internal swapAdapter;
    MandateVaultFactory internal vaultFactory;
    MandateVault internal vault;
    MockERC8004IdentityRegistry internal identityRegistry;

    MockERC20 internal nvda;
    MockPriceOracle internal priceOracle;

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
        vaultTrackRegistry = new VaultTrackRegistry(deployer);
        tokenRegistry = new TokenRegistry(deployer);
        identityRegistry = AgentTestLib.deployERC8004IdentityRegistry();
        registry = new AgentRegistry(deployer, feeManager, address(identityRegistry), block.chainid);
        allocationManager = new AllocationManager(deployer, vaultTrackRegistry);
        positionManager = new PositionManager(deployer);

        (vaultFactory,) = VaultTestLib.deployFactory(IERC20(address(usdc)));
        vault = VaultTestLib.deployVault(
            vaultFactory,
            IERC20(address(usdc)),
            "AlphaGrid Tech Vault",
            "agTECH",
            VAULT_MANDATE,
            tokenRegistry,
            deployer,
            treasury
        );
        vaultAddr = address(vault);

        swapAdapter = new MockSwapAdapter(address(0));
        tradeRouter =
            new TradeRouter(deployer, registry, allocationManager, positionManager, swapAdapter, vaultTrackRegistry);
        tradeRouterLens = new TradeRouterLens(tradeRouter, allocationManager, positionManager);
        tradeRouter.setLens(tradeRouterLens);
        swapAdapter.setTradeRouter(address(tradeRouter));

        feeManager.setAgentRegistry(address(registry));
        registry.setVaultTrackRegistry(vaultTrackRegistry);
        registry.setAllocationManager(allocationManager);
        allocationManager.setAgentRegistry(address(registry));
        positionManager.setTradeRouter(address(tradeRouter));

        registry.grantRole(registry.OPERATOR_ROLE(), operator);
        registry.grantRole(registry.REGISTRAR_ROLE(), operator);
        tradeRouter.grantRole(tradeRouter.EXECUTOR_ROLE(), executor);
        tradeRouter.grantRole(tradeRouter.OPERATOR_ROLE(), operator);

        vault.grantRole(vault.TRADE_ROUTER_ROLE(), address(tradeRouter));
        allocationManager.grantRole(allocationManager.TRADE_ROUTER_ROLE(), address(tradeRouter));

        vault.setMaxPriceAge(1 hours);
        tradeRouter.setKeeperBounty(50, 100e6);

        priceOracle = new MockPriceOracle(deployer);
        tokenRegistry.setPriceOracle(address(priceOracle));
        nvda = new MockERC20("Mock NVDA", "mNVDA", 18);
        priceOracle.setPrice(address(nvda), 150e8);
        tokenRegistry.registerToken(address(nvda));
        vault.enableToken(address(nvda));

        _setVaultTrackConfig(vaultAddr, 0, CHALLENGE_CAP, 200_000e6);

        usdc.mint(lp, LP_USDC);
        vm.stopPrank();

        vm.startPrank(lp);
        usdc.approve(vaultAddr, LP_USDC);
        vault.deposit(LP_USDC, lp);
        vm.stopPrank();
    }

    function _setTokenPrice(address token, int256 price) internal {
        vm.prank(deployer);
        priceOracle.setPrice(token, price);
    }

    function _setTokenUpdatedAt(address token, uint256 updatedAt_) internal {
        vm.prank(deployer);
        priceOracle.setUpdatedAt(token, updatedAt_);
    }

    function _registerAgent() internal returns (uint256 agentId) {
        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, agentOwner);
        vm.prank(operator);
        agentId = registry.registerAgent(agentOwner, vaultAddr, "Bot", "ipfs://bot", agentSigner, true, erc8004Id);
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

    function _openPosition(uint256 agentId, uint256 usdcAmount, int256 stopBps) internal returns (uint256 positionId) {
        IPositionTypes.PositionIntent memory intent = _singleStopIntent(agentId, usdcAmount, stopBps);
        bytes memory sig = _signOpenPosition(intent);
        vm.prank(executor);
        positionId = tradeRouter.openPosition(intent, sig);
    }

    function _signAddToPosition(IPositionTypes.AddToPositionIntent memory intent) internal view returns (bytes memory) {
        intent.deadline = block.timestamp + 1 hours;
        intent.nonce = tradeRouter.nonces(intent.agentId);

        bytes32 structHash = keccak256(
            abi.encode(
                tradeRouter.ADD_TO_POSITION_TYPEHASH(),
                intent.agentId,
                intent.positionId,
                intent.usdcAmount,
                intent.minTokenOut,
                intent.maxSlippageBps,
                intent.deadline,
                intent.nonce
            )
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(_routerDomainSeparator(), structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(AGENT_SIGNER_PK, digest);
        return abi.encodePacked(r, s, v);
    }

    function _signReducePosition(IPositionTypes.ReducePositionIntent memory intent)
        internal
        view
        returns (bytes memory)
    {
        intent.deadline = block.timestamp + 1 hours;
        intent.nonce = tradeRouter.nonces(intent.agentId);

        bytes32 structHash = keccak256(
            abi.encode(
                tradeRouter.REDUCE_POSITION_TYPEHASH(),
                intent.agentId,
                intent.positionId,
                intent.exitBps,
                intent.deadline,
                intent.nonce
            )
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(_routerDomainSeparator(), structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(AGENT_SIGNER_PK, digest);
        return abi.encodePacked(r, s, v);
    }

    function _signUpdateExitLadder(IPositionTypes.UpdateExitLadderIntent memory intent)
        internal
        view
        returns (bytes memory)
    {
        intent.deadline = block.timestamp + 1 hours;
        intent.nonce = tradeRouter.nonces(intent.agentId);

        bytes32 structHash = keccak256(
            abi.encode(
                tradeRouter.UPDATE_EXIT_LADDER_TYPEHASH(),
                intent.agentId,
                intent.positionId,
                _hashExitRules(intent.exits),
                intent.deadline,
                intent.nonce
            )
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(_routerDomainSeparator(), structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(AGENT_SIGNER_PK, digest);
        return abi.encodePacked(r, s, v);
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

    function _setMaxDailyLossBps(uint256 bps) internal {
        IVaultTrackRegistry.VaultTrackConfig memory config = vaultTrackRegistry.getVaultTrackConfig(vaultAddr, 0);
        config.maxDailyLossBps = bps;
        vm.prank(deployer);
        vaultTrackRegistry.setVaultTrackConfig(vaultAddr, 0, config);
    }

    function _setRequireTakeProfit(bool required) internal {
        IVaultTrackRegistry.VaultTrackConfig memory config = vaultTrackRegistry.getVaultTrackConfig(vaultAddr, 0);
        config.requireTakeProfit = required;
        vm.prank(deployer);
        vaultTrackRegistry.setVaultTrackConfig(vaultAddr, 0, config);
    }

    function _setVaultTrackConfig(address vault_, uint256 trackId, uint256 initialAllocation, uint256 maxAllocation)
        internal
    {
        vaultTrackRegistry.setVaultTrackConfig(
            vault_,
            trackId,
            IVaultTrackRegistry.VaultTrackConfig({
                vault: vault_,
                trackId: trackId,
                initialAllocation: initialAllocation,
                maxAllocation: maxAllocation,
                maxDrawdownBps: 1500,
                maxTradeSizeBps: 5000,
                maxDailyTurnoverBps: 2500,
                maxDailyLossBps: 0,
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
    }
}
