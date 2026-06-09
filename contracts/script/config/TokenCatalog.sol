// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { MandateVault } from "../../src/vaults/MandateVault.sol";
import { TokenRegistry } from "../../src/core/TokenRegistry.sol";

/// @notice Mock stock catalog definitions and per-vault allowlists.
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

    function enableVaultTokens(
        address[] memory tokens,
        MandateVault foundation,
        MandateVault tech,
        MandateVault volatility,
        MandateVault macroVault
    ) internal {
        // indices: 0 NVDA, 1 META, 2 TSLA, 3 AAPL, 4 MSFT, 5 COIN, 6 HOOD, 7 SPY
        _enable3(foundation, tokens[0], tokens[1], tokens[2]);
        _enable5(tech, tokens[0], tokens[1], tokens[2], tokens[4], tokens[5]);
        _enable4(volatility, tokens[0], tokens[2], tokens[5], tokens[6]);
        _enable4(macroVault, tokens[2], tokens[3], tokens[4], tokens[7]);
    }

    function _enable3(MandateVault vault, address t0, address t1, address t2) private {
        vault.enableToken(t0);
        vault.enableToken(t1);
        vault.enableToken(t2);
    }

    function _enable4(MandateVault vault, address t0, address t1, address t2, address t3) private {
        vault.enableToken(t0);
        vault.enableToken(t1);
        vault.enableToken(t2);
        vault.enableToken(t3);
    }

    function _enable5(MandateVault vault, address t0, address t1, address t2, address t3, address t4) private {
        vault.enableToken(t0);
        vault.enableToken(t1);
        vault.enableToken(t2);
        vault.enableToken(t3);
        vault.enableToken(t4);
    }
}
