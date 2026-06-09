// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { console2 } from "forge-std/Script.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { MandateVault } from "../../src/vaults/MandateVault.sol";
import { Fees } from "../config/Fees.sol";
import { DeploymentEnv } from "../helpers/DeploymentEnv.sol";

/// @notice Deposits USDC into the Tech vault (ERC-4626).
/// @dev Requires USDC, TECH_VAULT, DEPOSITOR, and PRIVATE_KEY in `.env`.
///      forge script script/ops/DepositToTechVault.s.sol:DepositToTechVault \
///        --rpc-url $RPC_URL --broadcast
contract DepositToTechVault is DeploymentEnv {
    function run() external {
        IERC20 usdc = IERC20(vm.envAddress("USDC"));
        MandateVault vault = MandateVault(vm.envAddress("TECH_VAULT"));
        address depositor = vm.envAddress("DEPOSITOR");
        uint256 depositAmount = vm.envOr("DEPOSIT_AMOUNT", Fees.DEFAULT_TECH_DEPOSIT);

        vm.startBroadcast();
        usdc.approve(address(vault), depositAmount);
        uint256 shares = vault.deposit(depositAmount, depositor);
        vm.stopBroadcast();

        console2.log("Vault:", address(vault));
        console2.log("Depositor:", depositor);
        console2.log("Deposited (raw):", depositAmount);
        console2.log("Shares received:", shares);
    }
}
