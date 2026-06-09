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
        address foundationVault;
        address techVault;
        address volatilityVault;
        address macroVault;
        address positionManager;
        address tradeRouter;
        address swapAdapter;
        address priceOracle;
        address usdc;
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
        string memory json = objectKey.serialize("chainId", snapshot.chainId);
        json = json.serialize("deployedAt", block.timestamp);
        json = json.serialize("FeeManager", snapshot.feeManager);
        json = json.serialize("VaultTrackRegistry", snapshot.vaultTrackRegistry);
        json = json.serialize("TokenRegistry", snapshot.tokenRegistry);
        json = json.serialize("AgentRegistry", snapshot.agentRegistry);
        json = json.serialize("AllocationManager", snapshot.allocationManager);
        json = json.serialize("VaultFactory", snapshot.vaultFactory);
        json = json.serialize("VaultImplementation", snapshot.vaultImplementation);
        json = json.serialize("FoundationVault", snapshot.foundationVault);
        json = json.serialize("TechVault", snapshot.techVault);
        json = json.serialize("VolatilityVault", snapshot.volatilityVault);
        json = json.serialize("MacroVault", snapshot.macroVault);
        json = json.serialize("PositionManager", snapshot.positionManager);
        json = json.serialize("TradeRouter", snapshot.tradeRouter);
        json = json.serialize("SwapAdapter", snapshot.swapAdapter);
        json = json.serialize("PriceOracle", snapshot.priceOracle);
        json = json.serialize("usdc", snapshot.usdc);
        json = json.serialize("tokens.NVDA", snapshot.tokenNvda);
        json = json.serialize("tokens.META", snapshot.tokenMeta);
        json = json.serialize("tokens.TSLA", snapshot.tokenTsla);
        json = json.serialize("tokens.AAPL", snapshot.tokenAapl);
        json = json.serialize("tokens.MSFT", snapshot.tokenMsft);
        json = json.serialize("tokens.COIN", snapshot.tokenCoin);
        json = json.serialize("tokens.HOOD", snapshot.tokenHood);
        json = json.serialize("tokens.SPY", snapshot.tokenSpy);

        string memory path = string.concat("./deployments/", vm.toString(snapshot.chainId), ".json");
        json.write(path);
    }
}
