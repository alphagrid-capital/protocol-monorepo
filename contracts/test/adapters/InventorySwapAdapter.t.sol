// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { InventorySwapAdapter } from "../../src/adapters/InventorySwapAdapter.sol";
import { AgentRegistry } from "../../src/core/AgentRegistry.sol";
import { AllocationManager } from "../../src/core/AllocationManager.sol";
import { FeeManager } from "../../src/core/FeeManager.sol";
import { PositionManager } from "../../src/core/PositionManager.sol";
import { TokenRegistry } from "../../src/core/TokenRegistry.sol";
import { TradeRouter } from "../../src/core/TradeRouter.sol";
import { VaultTrackRegistry } from "../../src/core/VaultTrackRegistry.sol";
import { IPositionTypes } from "../../src/interfaces/IPositionTypes.sol";
import { MockERC20 } from "../../src/mocks/MockERC20.sol";
import { TradingTestBase } from "../helpers/TradingTestBase.sol";
import { VaultTestLib } from "../helpers/VaultTestLib.sol";
import { MockPriceFeed } from "../mocks/MockPriceFeed.sol";

contract InventorySwapAdapterTest is TradingTestBase {
    InventorySwapAdapter internal inventoryAdapter;

    function setUp() public override {
        super.setUp();
        setUpTradingStackWithInventoryAdapter();
    }

    function setUpTradingStackWithInventoryAdapter() internal {
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
        registry = new AgentRegistry(deployer, feeManager);
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

        inventoryAdapter = new InventorySwapAdapter(address(0));
        tradeRouter = new TradeRouter(
            deployer, registry, allocationManager, positionManager, inventoryAdapter, vaultTrackRegistry
        );
        inventoryAdapter.setTradeRouter(address(tradeRouter));

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

        vault.setFeeRecipient(treasury);
        vault.setMaxPriceAge(1 hours);
        tradeRouter.setKeeperBounty(50, 100e6);

        nvda = new MockERC20("Mock NVDA", "mNVDA", 18);
        nvdaFeed = new MockPriceFeed(150e8, 8);
        tokenRegistry.registerToken(address(nvda), address(nvdaFeed));
        vault.enableToken(address(nvda));

        _setVaultTrackConfig(vaultAddr, 0, CHALLENGE_CAP, 200_000e6);

        usdc.mint(lp, LP_USDC);
        usdc.mint(address(inventoryAdapter), 500_000e6);
        nvda.mint(address(inventoryAdapter), 100_000e18);
        vm.stopPrank();

        vm.startPrank(lp);
        usdc.approve(vaultAddr, LP_USDC);
        vault.deposit(LP_USDC, lp);
        vm.stopPrank();
    }

    function test_OpenAndExitWithInventoryAdapter() public {
        uint256 agentId = _registerAgent();
        uint256 usdcAmount = 10_000e6;

        IPositionTypes.PositionIntent memory intent = _singleStopIntent(agentId, usdcAmount, -1000);
        bytes memory sig = _signOpenPosition(intent);

        vm.prank(executor);
        uint256 positionId = tradeRouter.openPosition(intent, sig);

        assertGt(positionManager.getPosition(positionId).tokenAmount, 0);
        assertEq(nvda.balanceOf(vaultAddr), positionManager.getPosition(positionId).tokenAmount);

        nvdaFeed.setPrice(120e8);
        vm.prank(makeAddr("keeper"));
        tradeRouter.executeExit(positionId);

        assertEq(positionManager.getPosition(positionId).tokenAmount, 0);
        assertGt(usdc.balanceOf(vaultAddr), LP_USDC - usdcAmount);
    }
}
