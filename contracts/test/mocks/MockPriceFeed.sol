// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IPriceFeed } from "../../src/interfaces/IPriceFeed.sol";

/// @title MockPriceFeed
/// @notice Test double for Chainlink-style price feeds.
contract MockPriceFeed is IPriceFeed {
    int256 public price;
    uint8 public feedDecimals;
    uint256 public updatedAt;

    constructor(int256 price_, uint8 feedDecimals_) {
        price = price_;
        feedDecimals = feedDecimals_;
        updatedAt = block.timestamp;
    }

    function setPrice(int256 price_) external {
        price = price_;
        updatedAt = block.timestamp;
    }

    function setUpdatedAt(uint256 updatedAt_) external {
        updatedAt = updatedAt_;
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt_, uint80 answeredInRound)
    {
        roundId = 1;
        answer = price;
        startedAt = updatedAt;
        updatedAt_ = updatedAt;
        answeredInRound = 1;
    }

    function decimals() external view returns (uint8) {
        return feedDecimals;
    }
}
