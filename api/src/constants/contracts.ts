import type { Network } from "@x402/core/types";

export type TokenConfig = {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
};

export type ChainContracts = {
  networkName: string;
  network: Network;
  agentRegistry: `0x${string}` | null;
  feeManager: `0x${string}` | null;
  usdc: TokenConfig;
};

export const contracts: Record<number, ChainContracts> = {
  84532: {
    networkName: "Base Sepolia",
    network: "eip155:84532",
    agentRegistry: null,
    feeManager: null,
    usdc: {
      address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      symbol: "USDC",
      name: "USDC",
      decimals: 6,
    },
  },
  42161: {
    networkName: "Arbitrum One",
    network: "eip155:42161",
    agentRegistry: null,
    feeManager: null,
    usdc: {
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
    },
  },
  421614: {
    networkName: "Arbitrum Sepolia",
    network: "eip155:421614",
    agentRegistry: null,
    feeManager: null,
    usdc: {
      address: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
    },
  },
  46630: {
    networkName: "Robinhood Chain Testnet",
    network: "eip155:46630",
    agentRegistry: null,
    feeManager: null,
    usdc: {
      address: "0x0000000000000000000000000000000000000000",
      symbol: "USDC",
      name: "USDC",
      decimals: 6,
    },
  },
};
