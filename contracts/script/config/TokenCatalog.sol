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
        stocks = new StockDef[](8);
        stocks[0] = StockDef({ name: "Mock NVIDIA", symbol: "mNVDA" });
        stocks[1] = StockDef({ name: "Mock Meta", symbol: "mMETA" });
        stocks[2] = StockDef({ name: "Mock Tesla", symbol: "mTSLA" });
        stocks[3] = StockDef({ name: "Mock Apple", symbol: "mAAPL" });
        stocks[4] = StockDef({ name: "Mock Microsoft", symbol: "mMSFT" });
        stocks[5] = StockDef({ name: "Mock Coinbase", symbol: "mCOIN" });
        stocks[6] = StockDef({ name: "Mock Robinhood", symbol: "mHOOD" });
        stocks[7] = StockDef({ name: "Mock SPY", symbol: "mSPY" });
    }

    function registerAll(TokenRegistry registry, address[] memory tokens) internal {
        uint256 len = tokens.length;
        for (uint256 i = 0; i < len; i++) {
            registry.registerToken(tokens[i]);
        }
    }

    /// @dev Genesis allowlist matches the former Tech vault: NVDA, META, TSLA, MSFT, COIN.
    function enableGenesisVaultTokens(address[] memory tokens, MandateVault genesis) internal {
        // indices: 0 NVDA, 1 META, 2 TSLA, 3 AAPL, 4 MSFT, 5 COIN, 6 HOOD, 7 SPY
        _enable5(genesis, tokens[0], tokens[1], tokens[2], tokens[4], tokens[5]);
    }

    function _enable5(MandateVault vault, address t0, address t1, address t2, address t3, address t4) private {
        vault.enableToken(t0);
        vault.enableToken(t1);
        vault.enableToken(t2);
        vault.enableToken(t3);
        vault.enableToken(t4);
    }
}
