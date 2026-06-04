import type { Network } from '@x402/core/types'

export interface TokenConfig {
  address: `0x${string}`
  symbol: string
  name: string
  decimals: number
}

export interface ChainContracts {
  networkName: string
  network: Network
  FeeManager: `0x${string}` | null
  VaultTrackRegistry: `0x${string}` | null
  TokenRegistry: `0x${string}` | null
  PriceOracle: `0x${string}` | null
  AgentRegistry: `0x${string}` | null
  AllocationManager: `0x${string}` | null
  VaultFactory: `0x${string}` | null
  VaultImplementation: `0x${string}` | null
  FoundationVault: `0x${string}` | null
  TechVault: `0x${string}` | null
  VolatilityVault: `0x${string}` | null
  MacroVault: `0x${string}` | null
  usdc: TokenConfig
}

export const contracts: Record<number, ChainContracts> = {
  84532: {
    networkName: 'Base Sepolia',
    network: 'eip155:84532',
    FeeManager: '0x6599cCCc646dCe746fA0b86690D36D78C3AA6943',
    VaultTrackRegistry: '0x675215dd3233b96Ed7944Aa1b25105AF9D0317D2',
    TokenRegistry: '0x4F29A28fA74d49173555Fd70BB769658034E02cD',
    AgentRegistry: '0x8D416f94E01933daF4B792586e3A8e09D1e541bf',
    AllocationManager: '0xa76a011Bd649B29CF73aB691ADE91Cfb3a6CDE34',
    VaultFactory: '0xbF1A49c6bE1a39D954a1ff43f3AF280FC6C873eF',
    VaultImplementation: '0xA3C721A384371d95d617d96c990E3e1ECdaAADB1',
    FoundationVault: '0x603086b9e9064647f8E5cD2ce37525fEcf089953',
    TechVault: '0x098dE57861012069292AE329E0a3E8AC17181c53',
    VolatilityVault: '0x5f9B0818be458607f19398Debb81995bc4a7Cbf3',
    MacroVault: '0x51c111f7287B42BC60A64Bf038d2868b520d0302',
    PriceOracle: '0x6E41Db913c61D654F8624958F0B5fE30bE7595Ac',
    usdc: {
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      symbol: 'USDC',
      name: 'USDC',
      decimals: 6,
    },
  },
  42161: {
    networkName: 'Arbitrum One',
    network: 'eip155:42161',
    FeeManager: null,
    VaultTrackRegistry: null,
    TokenRegistry: null,
    PriceOracle: null,
    AgentRegistry: null,
    AllocationManager: null,
    VaultFactory: null,
    VaultImplementation: null,
    FoundationVault: null,
    TechVault: null,
    VolatilityVault: null,
    MacroVault: null,
    usdc: {
      address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
  },
  421614: {
    networkName: 'Arbitrum Sepolia',
    network: 'eip155:421614',
    FeeManager: null,
    VaultTrackRegistry: null,
    TokenRegistry: null,
    PriceOracle: null,
    AgentRegistry: null,
    AllocationManager: null,
    VaultFactory: null,
    VaultImplementation: null,
    FoundationVault: null,
    TechVault: null,
    VolatilityVault: null,
    MacroVault: null,
    usdc: {
      address: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
  },
  46630: {
    networkName: 'Robinhood Chain Testnet',
    network: 'eip155:46630',
    FeeManager: null,
    VaultTrackRegistry: null,
    TokenRegistry: null,
    PriceOracle: null,
    AgentRegistry: null,
    AllocationManager: null,
    VaultFactory: null,
    VaultImplementation: null,
    FoundationVault: null,
    TechVault: null,
    VolatilityVault: null,
    MacroVault: null,
    usdc: {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'USDC',
      name: 'USDC',
      decimals: 6,
    },
  },
}
