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
  PositionManager: `0x${string}` | null
  TradeRouter: `0x${string}` | null
  TradeRouterLens: `0x${string}` | null
  SwapAdapter: `0x${string}` | null
  /** FeeManager / x402 registration (official USDC). */
  feeAsset: TokenConfig
  /** Vault + trading underlying (Mocked Stable on testnet). */
  vaultAsset: TokenConfig
  // Thematic vaults
  FoundationVault: `0x${string}` | null
  TechVault: `0x${string}` | null
  VolatilityVault: `0x${string}` | null
  MacroVault: `0x${string}` | null
}

export const contracts: Record<number, ChainContracts> = {
  84532: {
    networkName: 'Base Sepolia',
    network: 'eip155:84532',
    FeeManager: '0xa4d40dcfeb2915bf5e709b88b6b177d962422a4a',
    VaultTrackRegistry: '0xfe7843a9c59aa7f273d8567e47942c8a2f55e8e6',
    TokenRegistry: '0xd91015f3352f91208e98acd1f2438066d5f7effc',
    AgentRegistry: '0x5b8a93b13cd4939fb52bee581778081a7a2f1084',
    AllocationManager: '0xdd26d53baa2d2b6dc34dd87d1aa4b17a651c1292',
    VaultFactory: '0x46ceb0beff662f2fdf48957d6fc9101f8cbe8977',
    PriceOracle: '0x87c482ccdd60df9da3b3f02c6ad500587fa92c98',
    PositionManager: '0xc27558d2773a391a494cc7899831b304fbd2c2fb',
    TradeRouter: '0x12b0548e204c6d832b29d307e3c6154d029c4277',
    TradeRouterLens: null,
    SwapAdapter: '0xf645850781a781ab4583f7dcd03a3b9ac1192a22',
    FoundationVault: '0x0665b5ebc6692a2f770369ed6e4c652d0a460292',
    TechVault: '0xea3895c279bcab7f3d2fd18416500f781accebed',
    VolatilityVault: '0x6caf45c8c5a6c3765f3ffc91d830ce16f7507cb1',
    MacroVault: '0x87f9be8f34ee7784747b77d77b6d2ac9afe909a8',
    feeAsset: {
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      symbol: 'USDC',
      name: 'USDC',
      decimals: 6,
    },
    vaultAsset: {
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
    PositionManager: null,
    TradeRouter: null,
    TradeRouterLens: null,
    SwapAdapter: null,
    FoundationVault: null,
    TechVault: null,
    VolatilityVault: null,
    MacroVault: null,
    feeAsset: {
      address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
    vaultAsset: {
      address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
  },
  421614: {
    networkName: 'Arbitrum Sepolia',
    network: 'eip155:421614',
    FeeManager: '0x525862AF8B43E24ce523DF3cd933b9B83049c613',
    VaultTrackRegistry: '0x8725E61ebfe7116445b4531D0d63c5F55Ca9Ebf6',
    TokenRegistry: '0x33437Ee27267B552933975F9FBB5845C93c6135f',
    PriceOracle: '0xb2Df187dAc395E3CedD9DBE2f07Ac2d40f440dE6',
    AgentRegistry: '0x4148CC42Bb673b424a430eb1a3518DB4929C1c2B',
    AllocationManager: '0x9f84664B72F5F69eaDfF713B40de014214709A8C',
    VaultFactory: '0x244f924132cF1ec3b8e9b0faFB02D4Ac8E15a657',
    PositionManager: '0x9Db3cd7e776bc334fe0343d34eBcf775360da8B6',
    TradeRouter: '0x657b4dA89AeD3bD0f1d0aD0b2a9bDb33B1054cC2',
    TradeRouterLens: null,
    SwapAdapter: '0xb81eeEC997C5F6B8F858C0f70E7307109BA4F0F3',
    FoundationVault: '0x5187d55578BD7a7cD44FfBDF47cB43b7D10E8C4d',
    TechVault: '0xE7164E3eEb4F83ddb6149D06C8859DD3B763939d',
    VolatilityVault: '0x656a16dDc7420Aa53EBfcE79DD556453964356eC',
    MacroVault: '0x8bF7B28B7134Ae77d00B6f39A7BE963bfC657CaF',
    feeAsset: {
      address: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
    vaultAsset: {
      address: '0xa5231f925d785A402f70DDc162B5557Db0318958',
      symbol: 'mSTBL',
      name: 'Mocked Stable',
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
    PositionManager: null,
    TradeRouter: null,
    TradeRouterLens: null,
    SwapAdapter: null,
    FoundationVault: null,
    TechVault: null,
    VolatilityVault: null,
    MacroVault: null,
    feeAsset: {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'USDC',
      name: 'USDC',
      decimals: 6,
    },
    vaultAsset: {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'USDC',
      name: 'USDC',
      decimals: 6,
    },
  },
}
