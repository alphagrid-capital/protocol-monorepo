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
    FeeManager: '0x386716954D7c2e8E564b1558950727aD90e361d1',
    VaultTrackRegistry: '0xe3865cfc8FD79430ADb133E4eD8B618d28858a56',
    TokenRegistry: '0x3aFbc4035BFc77BD368925CABd535DcfA3bfc4c9',
    AgentRegistry: '0x06E65607DD380f2A8c67B02F82Acc2FE3EA6b3A4',
    AllocationManager: '0xE06733450584034A3A02aa255EA8743731971617',
    VaultFactory: '0xf396dB3b0c1C5a495446577e90f938CcB726dB0E',
    VaultImplementation: '0x1138139a0dC266Ea3c3a69428e80b21DB8098E0e',
    FoundationVault: '0x98e47A7CF1Cc880aDA3CC51D39b136BDf0D962AA',
    TechVault: '0x0853980Fa3B445CF3e3DEF2926D167Db35048A61',
    VolatilityVault: '0x372F63C1c2bCA269Da95Dd06567c5Cc5b94C20b0',
    MacroVault: '0x885f46965f452f02dF48d1d137d67777a185aFa4',
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
