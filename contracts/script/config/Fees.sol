// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice On-chain fee and deposit policy constants for deploy scripts.
library Fees {
    /// @dev 0.1 USDC with 6 decimals.
    uint256 internal constant REGISTRATION_FEE = 100_000;

    /// @dev 10 USDC with 6 decimals.
    uint256 internal constant DEFAULT_TECH_DEPOSIT = 10_000_000;
}
