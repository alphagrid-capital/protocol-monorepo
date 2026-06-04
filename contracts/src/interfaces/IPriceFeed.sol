// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title IPriceFeed
/// @notice Multi-asset price oracle interface.
interface IPriceFeed {
    function latestRoundData(address asset)
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);

    function decimals(address asset) external view returns (uint8);
}
