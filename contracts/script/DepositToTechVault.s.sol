// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Script, console2 } from "forge-std/Script.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { MandateVault } from "../src/vaults/MandateVault.sol";

/// @notice Deposits 10 USDC into the Tech vault (ERC-4626).
/// @dev Requires USDC, TECH_VAULT, and PRIVATE_KEY in `.env`.
///      forge script script/DepositToTechVault.s.sol:DepositToTechVault \
///        --rpc-url $RPC_URL --broadcast
contract DepositToTechVault is Script {
    /// @dev 10 USDC with 6 decimals.
    uint256 internal constant DEPOSIT_AMOUNT = 10_000_000;

    function run() external {
        IERC20 usdc = IERC20(vm.envAddress("USDC"));
        MandateVault vault = MandateVault(vm.envAddress("TECH_VAULT"));

        address depositor = 0x31adfE243828BB73e5186f77A66de459a4f568a8;

        vm.startBroadcast();
        usdc.approve(address(vault), DEPOSIT_AMOUNT);
        uint256 shares = vault.deposit(DEPOSIT_AMOUNT, depositor);
        vm.stopBroadcast();

        console2.log("Vault:", address(vault));
        console2.log("Depositor:", depositor);
        console2.log("Deposited (raw):", DEPOSIT_AMOUNT);
        console2.log("Shares received:", shares);
    }
}
