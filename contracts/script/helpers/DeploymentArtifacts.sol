// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { stdJson } from "forge-std/Script.sol";
import { DeploymentEnv } from "./DeploymentEnv.sol";

/// @notice Writes deployment snapshots to deployments/<chainId>.json.
abstract contract DeploymentArtifacts is DeploymentEnv {
    using stdJson for string;

    struct Snapshot {
        uint256 chainId;
        address feeManager;
        address vaultTrackRegistry;
        address tokenRegistry;
        address agentRegistry;
        address allocationManager;
        address vaultFactory;
        address vaultImplementation;
        address genesisVault;
        address positionManager;
        address tradeRouter;
        address tradeRouterLens;
        address swapAdapter;
        address priceOracle;
        address feeAsset;
        address vaultAsset;
        address tokenNvda;
        address tokenMeta;
        address tokenTsla;
        address tokenAapl;
        address tokenMsft;
        address tokenCoin;
        address tokenHood;
        address tokenSpy;
    }

    function writeSnapshot(Snapshot memory snapshot) internal {
        string memory objectKey = "deployment";
        objectKey.serialize("chainId", snapshot.chainId);
        objectKey.serialize("deployedAt", block.timestamp);
        objectKey.serialize("FeeManager", snapshot.feeManager);
        objectKey.serialize("VaultTrackRegistry", snapshot.vaultTrackRegistry);
        objectKey.serialize("TokenRegistry", snapshot.tokenRegistry);
        objectKey.serialize("AgentRegistry", snapshot.agentRegistry);
        objectKey.serialize("AllocationManager", snapshot.allocationManager);
        objectKey.serialize("VaultFactory", snapshot.vaultFactory);
        objectKey.serialize("VaultImplementation", snapshot.vaultImplementation);
        objectKey.serialize("GenesisVault", snapshot.genesisVault);
        objectKey.serialize("PositionManager", snapshot.positionManager);
        objectKey.serialize("TradeRouter", snapshot.tradeRouter);
        objectKey.serialize("TradeRouterLens", snapshot.tradeRouterLens);
        objectKey.serialize("SwapAdapter", snapshot.swapAdapter);
        objectKey.serialize("PriceOracle", snapshot.priceOracle);
        objectKey.serialize("feeAsset", snapshot.feeAsset);
        objectKey.serialize("vaultAsset", snapshot.vaultAsset);
        objectKey.serialize("usdc", snapshot.vaultAsset);
        objectKey.serialize("tokens.NVDA", snapshot.tokenNvda);
        objectKey.serialize("tokens.META", snapshot.tokenMeta);
        objectKey.serialize("tokens.TSLA", snapshot.tokenTsla);
        objectKey.serialize("tokens.AAPL", snapshot.tokenAapl);
        objectKey.serialize("tokens.MSFT", snapshot.tokenMsft);
        objectKey.serialize("tokens.COIN", snapshot.tokenCoin);
        objectKey.serialize("tokens.HOOD", snapshot.tokenHood);
        string memory json = objectKey.serialize("tokens.SPY", snapshot.tokenSpy);

        string memory path = string.concat("./deployments/", vm.toString(snapshot.chainId), ".json");
        json.write(path);
    }
}
