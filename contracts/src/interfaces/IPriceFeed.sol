// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title IPriceFeed
/// @notice Chainlink-compatible price feed interface for vault NAV.
interface IPriceFeed {
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);

    function decimals() external view returns (uint8);
}
