// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IMandateVault } from "../interfaces/IMandateVault.sol";
import { ISwapAdapter } from "../interfaces/ISwapAdapter.sol";
import { OracleLib } from "../libraries/OracleLib.sol";

/// @title InventorySwapAdapter
/// @notice Production swap adapter that settles from pre-funded ERC-20 inventory at oracle prices.
/// @dev Operators replenish adapter USDC/token balances off-chain (broker, treasury, or DEX).
///      TradeRouter must pull vault assets to this contract before calling swap functions.
contract InventorySwapAdapter is ISwapAdapter {
    using SafeERC20 for IERC20;

    address public tradeRouter;

    error ZeroAddress();
    error NotTradeRouter(address caller);
    error SlippageExceeded();
    error InsufficientUsdcBalance(uint256 required, uint256 available);
    error InsufficientTokenBalance(uint256 required, uint256 available);

    constructor(address tradeRouter_) {
        tradeRouter = tradeRouter_;
    }

    function setTradeRouter(address tradeRouter_) external {
        if (tradeRouter_ == address(0)) revert ZeroAddress();
        if (tradeRouter != address(0) && tradeRouter != tradeRouter_) revert NotTradeRouter(tradeRouter_);
        tradeRouter = tradeRouter_;
    }

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
        if (IERC20(token).balanceOf(address(this)) < tokenOut) {
            revert InsufficientTokenBalance(tokenOut, IERC20(token).balanceOf(address(this)));
        }

        usdc.safeTransfer(address(0xdead), usdcIn);
        IERC20(token).safeTransfer(vault, tokenOut);
    }

    /// @inheritdoc ISwapAdapter
    function swapTokenForUsdc(address vault, address token, uint256 tokenIn, uint256 minUsdcOut)
        external
        returns (uint256 usdcOut)
    {
        if (msg.sender != tradeRouter) revert NotTradeRouter(msg.sender);

        IMandateVault mandateVault = IMandateVault(vault);
        IERC20 usdc = IERC20(mandateVault.asset());

        if (IERC20(token).balanceOf(address(this)) < tokenIn) {
            revert InsufficientTokenBalance(tokenIn, IERC20(token).balanceOf(address(this)));
        }

        usdcOut = OracleLib.valueInAsset(
            tokenIn,
            mandateVault.tokenRegistry().priceOracle(),
            token,
            mandateVault.tokenRegistry().tokenDecimals(token),
            6,
            mandateVault.maxPriceAge()
        );
        if (usdcOut < minUsdcOut) revert SlippageExceeded();
        if (usdc.balanceOf(address(this)) < usdcOut) {
            revert InsufficientUsdcBalance(usdcOut, usdc.balanceOf(address(this)));
        }

        IERC20(token).safeTransfer(address(0xdead), tokenIn);
        usdc.safeTransfer(vault, usdcOut);
    }

    function _usdcToTokenAmount(IMandateVault vault, address token, uint256 usdcIn) internal view returns (uint256) {
        uint8 tokenDecimals = vault.tokenRegistry().tokenDecimals(token);
        uint256 oneTokenUsdc = OracleLib.valueInAsset(
            10 ** tokenDecimals, vault.tokenRegistry().priceOracle(), token, tokenDecimals, 6, vault.maxPriceAge()
        );
        if (oneTokenUsdc == 0) return 0;
        return (usdcIn * (10 ** tokenDecimals)) / oneTokenUsdc;
    }
}
