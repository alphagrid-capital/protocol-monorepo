// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Script, console2 } from "forge-std/Script.sol";
import { MockERC20 } from "../src/mocks/MockERC20.sol";
import { TokenRegistry } from "../src/core/TokenRegistry.sol";
import { MandateVault } from "../src/vaults/MandateVault.sol";

/// @notice Deploys mock stock ERC20s, registers them, and enables per-vault allowlists.
/// @dev Run after DeployPriceOracle (TOKEN_REGISTRY must have priceOracle set). Prices are not
///      seeded here — the API cron keeper calls MockPriceOracle.setPrices.
contract DeployTokenCatalog is Script {
    struct StockDef {
        string name;
        string symbol;
    }

    function run() external {
        StockDef[] memory defs = _stockDefs();
        uint256 n = defs.length;
        address[] memory tokens = new address[](n);

        vm.startBroadcast();

        for (uint256 i = 0; i < n; i++) {
            tokens[i] = address(new MockERC20(defs[i].name, defs[i].symbol, 18));
            console2.log("MockERC20", defs[i].symbol, tokens[i]);
        }

        _registerAll(TokenRegistry(vm.envAddress("TOKEN_REGISTRY")), tokens);
        _enableVaultTokens(tokens);

        vm.stopBroadcast();

        console2.log("Deployed", n, "mock stocks; copy addresses into config/token-catalog.json");
    }

    function _stockDefs() private pure returns (StockDef[] memory stocks) {
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

    function _registerAll(TokenRegistry registry, address[] memory tokens) private {
        uint256 len = tokens.length;
        for (uint256 i = 0; i < len; i++) {
            registry.registerToken(tokens[i]);
        }
    }

    function _enableVaultTokens(address[] memory tokens) private {
        MandateVault foundation = MandateVault(vm.envAddress("FOUNDATION_VAULT"));
        MandateVault tech = MandateVault(vm.envAddress("TECH_VAULT"));
        MandateVault volatility = MandateVault(vm.envAddress("VOLATILITY_VAULT"));
        MandateVault macroVault = MandateVault(vm.envAddress("MACRO_VAULT"));

        // indices: 0 NVDA, 1 META, 2 TSLA, 3 AAPL, 4 MSFT, 5 COIN, 6 HOOD, 7 SPY
        _enable(foundation, tokens[0], tokens[1], tokens[2]);
        _enable(tech, tokens[0], tokens[1], tokens[2], tokens[4], tokens[5]);
        _enable(volatility, tokens[0], tokens[2], tokens[5], tokens[6]);
        _enable(macroVault, tokens[2], tokens[3], tokens[4], tokens[7]);
    }

    function _enable(MandateVault vault, address t0, address t1, address t2) private {
        vault.enableToken(t0);
        vault.enableToken(t1);
        vault.enableToken(t2);
    }

    function _enable(MandateVault vault, address t0, address t1, address t2, address t3) private {
        vault.enableToken(t0);
        vault.enableToken(t1);
        vault.enableToken(t2);
        vault.enableToken(t3);
    }

    function _enable(MandateVault vault, address t0, address t1, address t2, address t3, address t4) private {
        vault.enableToken(t0);
        vault.enableToken(t1);
        vault.enableToken(t2);
        vault.enableToken(t3);
        vault.enableToken(t4);
    }
}
