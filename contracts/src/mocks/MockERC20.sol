// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockERC20
/// @notice Simple mintable ERC-20 for tests and local development.
contract MockERC20 is ERC20 {
    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    uint8 private immutable _DECIMALS;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _DECIMALS = decimals_;
        _mint(msg.sender, 1_000_000 * 10 ** decimals_);
    }

    // -------------------------------------------------------------------------
    // Public Functions
    // -------------------------------------------------------------------------

    function decimals() public view override returns (uint8) {
        return _DECIMALS;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}
