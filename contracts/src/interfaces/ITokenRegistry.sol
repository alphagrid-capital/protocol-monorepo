// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title ITokenRegistry
/// @notice Protocol-wide catalog of tradable tokens and their oracle price feeds.
interface ITokenRegistry {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    struct TokenConfig {
        address priceFeed;
        uint8 decimals;
        bool active;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event TokenRegistered(address indexed token, address indexed priceFeed, uint8 decimals);

    event TokenPriceFeedUpdated(address indexed token, address indexed priceFeed);

    event TokenActiveUpdated(address indexed token, bool active);

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @notice Returns whether `token` has been registered.
    function isTokenListed(address token) external view returns (bool);

    /// @notice Returns whether `token` is registered and globally active.
    function isTokenActive(address token) external view returns (bool);

    function priceFeedOf(address token) external view returns (address);

    function tokenDecimals(address token) external view returns (uint8);

    function getTokenConfig(address token) external view returns (TokenConfig memory);

    function tokenAt(uint256 index) external view returns (address);

    function tokenCount() external view returns (uint256);

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function registerToken(address token, address priceFeed) external;

    function updatePriceFeed(address token, address priceFeed) external;

    function setTokenActive(address token, bool active) external;
}
