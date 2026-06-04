// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title ITokenRegistry
/// @notice Protocol-wide catalog of tradable tokens backed by a shared price oracle.
interface ITokenRegistry {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    struct TokenConfig {
        uint8 decimals;
        bool active;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event PriceOracleSet(address indexed priceOracle);

    event TokenRegistered(address indexed token, uint8 decimals);

    event TokenActiveUpdated(address indexed token, bool active);

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function priceOracle() external view returns (address);

    /// @notice Returns whether `token` has been registered.
    function isTokenListed(address token) external view returns (bool);

    /// @notice Returns whether `token` is registered and globally active.
    function isTokenActive(address token) external view returns (bool);

    function tokenDecimals(address token) external view returns (uint8);

    function getTokenConfig(address token) external view returns (TokenConfig memory);

    function tokenAt(uint256 index) external view returns (address);

    function tokenCount() external view returns (uint256);

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setPriceOracle(address priceOracle) external;

    function registerToken(address token) external;

    function setTokenActive(address token, bool active) external;
}
