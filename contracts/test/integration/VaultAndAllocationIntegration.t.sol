// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { AgentRegistry } from "../../src/core/AgentRegistry.sol";
import { AllocationManager } from "../../src/core/AllocationManager.sol";
import { FeeManager } from "../../src/core/FeeManager.sol";
import { TokenRegistry } from "../../src/core/TokenRegistry.sol";
import { VaultTrackRegistry } from "../../src/core/VaultTrackRegistry.sol";
import { IAgentRegistry } from "../../src/interfaces/IAgentRegistry.sol";
import { IVaultTrackRegistry } from "../../src/interfaces/IVaultTrackRegistry.sol";
import { MandateVault } from "../../src/vaults/MandateVault.sol";
import { MandateVaultFactory } from "../../src/vaults/MandateVaultFactory.sol";
import { AgentTestLib } from "../helpers/AgentTestLib.sol";
import { BaseTest } from "../helpers/BaseTest.sol";
import { MockERC8004IdentityRegistry } from "../mocks/MockERC8004IdentityRegistry.sol";
import { VaultTestLib } from "../helpers/VaultTestLib.sol";

/// @notice End-to-end wiring for vault deposits, allocations, and agent funding.
contract VaultAndAllocationIntegrationTest is BaseTest {
    AgentRegistry internal registry;
    FeeManager internal feeManager;
    VaultTrackRegistry internal vaultTrackRegistry;
    AllocationManager internal allocationManager;
    MandateVault internal genesisVault;
    MockERC8004IdentityRegistry internal identityRegistry;

    address internal treasury;
    address internal operator;
    address internal lp;

    uint256 internal constant SEED_DEPOSIT = 500_000e6;
    uint256 internal constant CHALLENGE_CAP = 10_000e6;

    function setUp() public override {
        super.setUp();

        treasury = makeAddr("treasury");
        operator = makeAddr("operator");
        lp = makeAddr("lp");

        vm.startPrank(deployer);
        feeManager = new FeeManager(deployer, treasury, address(usdc));
        vaultTrackRegistry = new VaultTrackRegistry(deployer);
        identityRegistry = AgentTestLib.deployERC8004IdentityRegistry();
        registry = new AgentRegistry(deployer, feeManager, address(identityRegistry), block.chainid);
        allocationManager = new AllocationManager(deployer, vaultTrackRegistry);
        TokenRegistry tokenRegistry = new TokenRegistry(deployer);
        MandateVaultFactory vaultFactory;
        (vaultFactory,) = VaultTestLib.deployFactory(IERC20(address(usdc)));
        genesisVault = VaultTestLib.deployVault(
            vaultFactory,
            IERC20(address(usdc)),
            "AlphaGrid Genesis Vault",
            "agGEN",
            "GENESIS",
            tokenRegistry,
            deployer,
            treasury
        );

        feeManager.setAgentRegistry(address(registry));
        registry.setVaultTrackRegistry(vaultTrackRegistry);
        registry.setAllocationManager(allocationManager);
        allocationManager.setAgentRegistry(address(registry));

        registry.grantRole(registry.OPERATOR_ROLE(), operator);
        registry.grantRole(registry.REGISTRAR_ROLE(), operator);

        _setVaultTrackConfig(address(genesisVault), 0, CHALLENGE_CAP, 25_000e6);
        _setVaultTrackConfig(address(genesisVault), 1, 50_000e6, 100_000e6);
        usdc.mint(lp, SEED_DEPOSIT);
        vm.stopPrank();

        vm.startPrank(lp);
        usdc.approve(address(genesisVault), SEED_DEPOSIT);
        genesisVault.deposit(SEED_DEPOSIT, lp);
        vm.stopPrank();
    }

    function _registerAlice() internal returns (uint256 agentId) {
        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, alice);
        agentId =
            registry.registerAgent(alice, address(genesisVault), "Alpha Bot", "ipfs://alpha", alice, true, erc8004Id);
    }

    function test_RegisterAgentCreatesAllocationAgainstRealVault() public {
        vm.startPrank(operator);
        uint256 agentId = _registerAlice();
        vm.stopPrank();

        assertEq(allocationManager.allocationCap(agentId), CHALLENGE_CAP);
        assertEq(genesisVault.totalAssets(), SEED_DEPOSIT);
    }

    function test_PromoteUpdatesAllocationCap() public {
        vm.startPrank(operator);
        uint256 agentId = _registerAlice();
        registry.promoteAgent(agentId, IAgentRegistry.Track.FUNDED, alice, false);
        vm.stopPrank();

        assertEq(allocationManager.allocationCap(agentId), 50_000e6);
        assertEq(uint256(registry.trackOf(agentId)), uint256(IAgentRegistry.Track.FUNDED));
    }

    function _setVaultTrackConfig(address vault_, uint256 trackId, uint256 initialAllocation, uint256 maxAllocation)
        internal
    {
        vaultTrackRegistry.setVaultTrackConfig(
            vault_,
            trackId,
            IVaultTrackRegistry.VaultTrackConfig({
                vault: vault_,
                trackId: trackId,
                initialAllocation: initialAllocation,
                maxAllocation: maxAllocation,
                maxDrawdownBps: 1500,
                maxTradeSizeBps: 500,
                maxDailyTurnoverBps: 2500,
                maxDailyLossBps: 0,
                evaluationPeriod: 14 days,
                minTrades: 5,
                promotionScore: 70,
                active: true,
                maxStopLossBps: 1500,
                minTakeProfitBps: 0,
                maxTakeProfitBps: 10_000,
                requireStopLoss: true,
                requireTakeProfit: false
            })
        );
    }
}
