// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { console2 } from "forge-std/Script.sol";
import { InventorySwapAdapter } from "../src/adapters/InventorySwapAdapter.sol";
import { MockSwapAdapter } from "../src/adapters/MockSwapAdapter.sol";
import { PositionManager } from "../src/core/PositionManager.sol";
import { TradeRouter } from "../src/core/TradeRouter.sol";
import { TradeRouterLens } from "../src/core/TradeRouterLens.sol";
import { ISwapAdapter } from "../src/interfaces/ISwapAdapter.sol";
import { MockERC20 } from "../src/mocks/MockERC20.sol";
import { MockPriceOracle } from "../src/mocks/MockPriceOracle.sol";
import { MandateVault } from "../src/vaults/MandateVault.sol";
import { Fees } from "./config/Fees.sol";
import { TokenCatalog } from "./config/TokenCatalog.sol";
import { AgentCoreDeploy } from "./helpers/AgentCoreDeploy.sol";
import { AssetDeploy } from "./helpers/AssetDeploy.sol";
import { DeploymentArtifacts } from "./helpers/DeploymentArtifacts.sol";
import { VaultDeploy } from "./helpers/VaultDeploy.sol";

/// @notice Dev-complete greenfield deploy: core + tracks + trading + oracle + mock token catalog.
/// @dev `FEE_ASSET` (x402 USDC) and `VAULT_ASSET` (Mocked Stable for vaults/trading) are separate.
///      When `VAULT_ASSET` is unset, deploys MockERC20 (`mSTBL`). When `FEE_ASSET` is unset, defaults
///      to `VAULT_ASSET`. Legacy `USDC` sets both when the newer vars are omitted.
///      Production rollouts should use staged individual scripts instead.
contract DeployFullStack is AgentCoreDeploy, VaultDeploy, AssetDeploy, DeploymentArtifacts {
    struct TradingDeployed {
        PositionManager positionManager;
        TradeRouter tradeRouter;
        TradeRouterLens tradeRouterLens;
        ISwapAdapter swapAdapter;
    }

    function run() external {
        address admin = vm.envAddress("ADMIN");
        address treasury = vm.envAddress("TREASURY");
        address backendRelayer = vm.envAddress("BACKEND_RELAYER");
        address executor = vm.envAddress("EXECUTOR");
        address operator = vm.envOr("OPERATOR", admin);
        bool deployMock = vm.envOr("DEPLOY_MOCK_SWAP_ADAPTER", true);

        vm.startBroadcast();

        ResolvedAssets memory assets = resolveAssets(true);

        AgentCoreDeployed memory core = deployAgentCore(admin, treasury, assets.feeAsset, true);
        VaultSet memory vaults = deployVaults(assets.vaultAsset, core.tokenRegistry, admin, treasury);
        wireAgentCore(core, Fees.REGISTRATION_FEE);
        grantRegistrarRole(core.registry, backendRelayer);
        configureVaultTracks(core.vaultTrackRegistry, vaults);

        address[] memory vaultAddrs = vaultAddressesFrom(address(vaults.genesisVault));

        TradingDeployed memory trading = _deployTrading(admin, executor, operator, deployMock, core, vaults, vaultAddrs);

        MockPriceOracle oracle = new MockPriceOracle(admin);
        core.tokenRegistry.setPriceOracle(address(oracle));
        address keeper = vm.envOr("ORACLE_KEEPER", address(0));
        if (keeper != address(0)) {
            oracle.grantRole(oracle.ORACLE_UPDATER_ROLE(), keeper);
        }

        TokenCatalog.StockDef[] memory defs = TokenCatalog.stockDefs();
        uint256 n = defs.length;
        address[] memory tokens = new address[](n);
        for (uint256 i = 0; i < n; i++) {
            tokens[i] = address(new MockERC20(defs[i].name, defs[i].symbol, 18));
            console2.log("MockERC20", defs[i].symbol, tokens[i]);
        }
        TokenCatalog.registerAll(core.tokenRegistry, tokens);
        TokenCatalog.enableGenesisVaultTokens(tokens, vaults.genesisVault);

        vm.stopBroadcast();

        writeSnapshot(
            DeploymentArtifacts.Snapshot({
                chainId: block.chainid,
                feeManager: address(core.feeManager),
                vaultTrackRegistry: address(core.vaultTrackRegistry),
                tokenRegistry: address(core.tokenRegistry),
                agentRegistry: address(core.registry),
                allocationManager: address(core.allocationManager),
                vaultFactory: address(vaults.factory),
                vaultImplementation: vaults.factory.implementation(),
                genesisVault: address(vaults.genesisVault),
                positionManager: address(trading.positionManager),
                tradeRouter: address(trading.tradeRouter),
                tradeRouterLens: address(trading.tradeRouterLens),
                swapAdapter: address(trading.swapAdapter),
                priceOracle: address(oracle),
                feeAsset: assets.feeAsset,
                vaultAsset: assets.vaultAsset,
                tokenNvda: tokens[0],
                tokenMeta: tokens[1],
                tokenTsla: tokens[2],
                tokenAapl: tokens[3],
                tokenMsft: tokens[4],
                tokenCoin: tokens[5],
                tokenHood: tokens[6],
                tokenSpy: tokens[7]
            })
        );

        console2.log("Full stack deployed. Artifact: deployments/", block.chainid, ".json");
        console2.log("Fee asset (FeeManager):", assets.feeAsset);
        console2.log("Vault asset (trading):", assets.vaultAsset);
        console2.log(
            "Copy token addresses into api/src/contracts/token-catalog.json and update api/src/constants/contracts.ts"
        );
    }

    function _deployTrading(
        address admin,
        address executor,
        address operator,
        bool deployMock,
        AgentCoreDeployed memory core,
        VaultSet memory vaults,
        address[] memory vaultAddrs
    ) private returns (TradingDeployed memory deployed) {
        deployed.positionManager = new PositionManager(admin);
        deployed.swapAdapter = deployMock
            ? ISwapAdapter(address(new MockSwapAdapter(address(0))))
            : ISwapAdapter(address(new InventorySwapAdapter(address(0))));

        deployed.tradeRouter = new TradeRouter(
            admin,
            core.registry,
            core.allocationManager,
            deployed.positionManager,
            deployed.swapAdapter,
            core.vaultTrackRegistry
        );
        deployed.tradeRouterLens =
            new TradeRouterLens(deployed.tradeRouter, core.allocationManager, deployed.positionManager);
        deployed.tradeRouter.setLens(deployed.tradeRouterLens);

        if (deployMock) {
            MockSwapAdapter(address(deployed.swapAdapter)).setTradeRouter(address(deployed.tradeRouter));
        } else {
            InventorySwapAdapter(address(deployed.swapAdapter)).setTradeRouter(address(deployed.tradeRouter));
        }
        deployed.positionManager.setTradeRouter(address(deployed.tradeRouter));

        deployed.tradeRouter.grantRole(deployed.tradeRouter.EXECUTOR_ROLE(), executor);
        deployed.tradeRouter.grantRole(deployed.tradeRouter.OPERATOR_ROLE(), operator);

        bytes32 tradeRouterRole = vaults.genesisVault.TRADE_ROUTER_ROLE();
        for (uint256 i = 0; i < vaultAddrs.length; i++) {
            MandateVault(vaultAddrs[i]).grantRole(tradeRouterRole, address(deployed.tradeRouter));
        }
        core.allocationManager.grantRole(core.allocationManager.TRADE_ROUTER_ROLE(), address(deployed.tradeRouter));
    }
}
