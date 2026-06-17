// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { MandateVault } from "../../src/vaults/MandateVault.sol";
import { TokenRegistry } from "../../src/core/TokenRegistry.sol";

/// @notice Mock stock catalog definitions and Genesis vault allowlist.
library TokenCatalog {
    struct StockDef {
        string name;
        string symbol;
    }

    function stockDefs() internal pure returns (StockDef[] memory stocks) {
        stocks = new StockDef[](10);
        stocks[0] = StockDef({ name: "Mock NVIDIA", symbol: "mNVDA" });
        stocks[1] = StockDef({ name: "Mock Meta", symbol: "mMETA" });
        stocks[2] = StockDef({ name: "Mock Tesla", symbol: "mTSLA" });
        stocks[3] = StockDef({ name: "Mock Apple", symbol: "mAAPL" });
        stocks[4] = StockDef({ name: "Mock Microsoft", symbol: "mMSFT" });
        stocks[5] = StockDef({ name: "Mock Coinbase", symbol: "mCOIN" });
        stocks[6] = StockDef({ name: "Mock Robinhood", symbol: "mHOOD" });
        stocks[7] = StockDef({ name: "Mock SPY", symbol: "mSPY" });
        stocks[8] = StockDef({ name: "Mock Alphabet", symbol: "mGOOGL" });
        stocks[9] = StockDef({ name: "Mock Amazon", symbol: "mAMZN" });
    }

    function registerAll(TokenRegistry registry, address[] memory tokens) internal {
        uint256 len = tokens.length;
        for (uint256 i = 0; i < len; i++) {
            registry.registerToken(tokens[i]);
        }
    }

    /// @dev Enables every mock stock on the Genesis vault allowlist.
    function enableGenesisVaultTokens(address[] memory tokens, MandateVault genesis) internal {
        uint256 len = tokens.length;
        for (uint256 i = 0; i < len; i++) {
            genesis.enableToken(tokens[i]);
        }
    }
}
