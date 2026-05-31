// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title ISwapAdapter
/// @notice Executes swaps against vault-held assets for TradeRouter.
interface ISwapAdapter {
    /// @dev TradeRouter must pull USDC from `vault` to the adapter before calling.
    function swapUsdcForToken(address vault, address token, uint256 usdcIn, uint256 minTokenOut)
        external
        returns (uint256 tokenOut);

    /// @dev TradeRouter must pull `token` from `vault` to the adapter before calling.
    function swapTokenForUsdc(address vault, address token, uint256 tokenIn, uint256 minUsdcOut)
        external
        returns (uint256 usdcOut);
}
