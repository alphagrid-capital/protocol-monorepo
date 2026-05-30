// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IPriceFeed } from "../interfaces/IPriceFeed.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @title OracleLib
/// @notice Converts token amounts to the vault deposit asset using a Chainlink-style feed.
library OracleLib {
    error InvalidPrice();
    error StalePrice(uint256 updatedAt, uint256 maxAge);

    /// @dev Returns `amount` valued in `assetDecimals` (e.g. USDC with 6 decimals).
    /// @param maxPriceAge Maximum oracle age in seconds; `0` disables staleness checks.
    function valueInAsset(
        uint256 amount,
        address priceFeed,
        uint8 tokenDecimals,
        uint8 assetDecimals,
        uint256 maxPriceAge
    ) internal view returns (uint256) {
        if (amount == 0) return 0;

        (, int256 answer,, uint256 updatedAt,) = IPriceFeed(priceFeed).latestRoundData();
        if (answer <= 0) revert InvalidPrice();
        if (maxPriceAge != 0 && block.timestamp - updatedAt > maxPriceAge) {
            revert StalePrice(updatedAt, maxPriceAge);
        }

        uint8 feedDecimals = IPriceFeed(priceFeed).decimals();
        uint256 price = SafeCast.toUint256(answer);

        // amount * price, normalized to asset decimals.
        uint256 value = (amount * price) / (10 ** tokenDecimals);
        if (feedDecimals > assetDecimals) {
            value /= 10 ** (feedDecimals - assetDecimals);
        } else if (assetDecimals > feedDecimals) {
            value *= 10 ** (assetDecimals - feedDecimals);
        }
        return value;
    }
}
