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
  PositionManager: `0x${string}` | null
  TradeRouter: `0x${string}` | null
  SwapAdapter: `0x${string}` | null
  usdc: TokenConfig
}

export const contracts: Record<number, ChainContracts> = {
  84532: {
    networkName: 'Base Sepolia',
    network: 'eip155:84532',
    FeeManager: '0xE295324C2C4Ec319a5a9C08D0589153001b2e725',
    VaultTrackRegistry: '0xF36BaBDDd7AC344a52140d82DfA33bAC66AfdAd6',
    TokenRegistry: '0x5231AE8377553e00E6AdC5514644ee7a770A61A3',
    AgentRegistry: '0xF1A4e2c9F8231A2194129197b3e14c78c9152883',
    AllocationManager: '0x9dAbAf6fF009C90D23f2Bc70938d1e576859C4Eb',
    VaultFactory: '0x7F445aF21486C2b045f00E4D3A5be2AC131951F0',
    VaultImplementation: '0xA3C721A384371d95d617d96c990E3e1ECdaAADB1',
    FoundationVault: '0xF192568fbee7cd80bc24dB4e24A2ab0a0ABBB932',
    TechVault: '0x7d1322C0D142A644eef35DB7171039552B4b2666',
    VolatilityVault: '0x50c8B26282fBa12b9d0f39ff05bfe5A4E1ea0daF',
    MacroVault: '0x43cD4Ef80a9AeB50b301634f31208f8f7ffA2efB',
    PriceOracle: '0x453321b57eD44217bC8217374d5913caBaC92c40',
    PositionManager: '0xE5A1f3b38a991a9930937a58C068693583C61Ab4',
    TradeRouter: '0x3fDCA550929889B3eFC8894f2C03Db5B53f947FD',
    SwapAdapter: '0x6a9e64992Fd7F94080003A02473181d54bA319c5',
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
    PositionManager: null,
    TradeRouter: null,
    SwapAdapter: null,
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
    PositionManager: null,
    TradeRouter: null,
    SwapAdapter: null,
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
    PositionManager: null,
    TradeRouter: null,
    SwapAdapter: null,
    usdc: {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'USDC',
      name: 'USDC',
      decimals: 6,
    },
  },
}
