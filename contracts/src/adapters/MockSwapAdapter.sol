// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IMandateVault } from "../interfaces/IMandateVault.sol";
import { ISwapAdapter } from "../interfaces/ISwapAdapter.sol";
import { OracleLib } from "../libraries/OracleLib.sol";

interface IMintableToken {
    function mint(address to, uint256 amount) external;
}

/// @title MockSwapAdapter
/// @notice Test swap adapter that prices via TokenRegistry oracles and mints mock assets.
/// @dev TradeRouter must pull vault assets to this contract before calling swap functions.
contract MockSwapAdapter is ISwapAdapter {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    address public tradeRouter;

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error NotTradeRouter(address caller);
    error SlippageExceeded();
    error InsufficientUsdcBalance(uint256 required, uint256 available);
    error InsufficientTokenBalance(uint256 required, uint256 available);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address tradeRouter_) {
        tradeRouter = tradeRouter_;
    }

    function setTradeRouter(address tradeRouter_) external {
        if (tradeRouter_ == address(0)) revert ZeroAddress();
        if (tradeRouter != address(0) && tradeRouter != tradeRouter_) revert NotTradeRouter(tradeRouter_);
        tradeRouter = tradeRouter_;
    }

    // -------------------------------------------------------------------------
    // ISwapAdapter
    // -------------------------------------------------------------------------

    /// @inheritdoc ISwapAdapter
    function swapUsdcForToken(address vault, address token, uint256 usdcIn, uint256 minTokenOut)
        external
        returns (uint256 tokenOut)
    {
        if (msg.sender != tradeRouter) revert NotTradeRouter(msg.sender);

        IMandateVault mandateVault = IMandateVault(vault);
        IERC20 usdc = IERC20(mandateVault.asset());
        if (usdc.balanceOf(address(this)) < usdcIn) {
            revert InsufficientUsdcBalance(usdcIn, usdc.balanceOf(address(this)));
        }

        tokenOut = _usdcToTokenAmount(mandateVault, token, usdcIn);
        if (tokenOut < minTokenOut) revert SlippageExceeded();

        usdc.safeTransfer(address(0xdead), usdcIn);
        IMintableToken(token).mint(vault, tokenOut);
    }

    /// @inheritdoc ISwapAdapter
    function swapTokenForUsdc(address vault, address token, uint256 tokenIn, uint256 minUsdcOut)
        external
        returns (uint256 usdcOut)
    {
        if (msg.sender != tradeRouter) revert NotTradeRouter(msg.sender);

        if (IERC20(token).balanceOf(address(this)) < tokenIn) {
            revert InsufficientTokenBalance(tokenIn, IERC20(token).balanceOf(address(this)));
        }

        IMandateVault mandateVault = IMandateVault(vault);
        usdcOut = OracleLib.valueInAsset(
            tokenIn,
            mandateVault.tokenRegistry().priceOracle(),
            token,
            mandateVault.tokenRegistry().tokenDecimals(token),
            mandateVault.assetDecimals(),
            mandateVault.maxPriceAge()
        );
        if (usdcOut < minUsdcOut) revert SlippageExceeded();

        IERC20(token).safeTransfer(address(0xdead), tokenIn);
        IMintableToken(mandateVault.asset()).mint(vault, usdcOut);
    }

    // -------------------------------------------------------------------------
    // Private Functions
    // -------------------------------------------------------------------------

    function _usdcToTokenAmount(IMandateVault vault, address token, uint256 usdcIn) internal view returns (uint256) {
        uint8 tokenDecimals = vault.tokenRegistry().tokenDecimals(token);
        uint256 oneTokenUsdc = OracleLib.valueInAsset(
            10 ** tokenDecimals,
            vault.tokenRegistry().priceOracle(),
            token,
            tokenDecimals,
            vault.assetDecimals(),
            vault.maxPriceAge()
        );
        if (oneTokenUsdc == 0) return 0;
        return (usdcIn * (10 ** tokenDecimals)) / oneTokenUsdc;
    }
}
