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
  /** Challenge arena ERC-4626 vault (formerly Tech vault on testnet). */
  GenesisVault: `0x${string}` | null
  /** First block to scan for TradeRouter / PositionManager logs (chain deploy). */
  tradingLogFromBlock?: bigint
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
    GenesisVault: '0xea3895c279bcab7f3d2fd18416500f781accebed',
    tradingLogFromBlock: 42_661_563n,
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
    GenesisVault: null,
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
    FeeManager: '0xA8809d8f90D91FF054c248A09e025A2B346Df920',
    VaultTrackRegistry: '0x3b0b255e3DFc98a02235f40Ea6b9754C830C761e',
    TokenRegistry: '0x08b53782E23a65d74e54bd2fA9A48BF8C6ba2577',
    PriceOracle: '0xE80f85c9194Cd6d824b5e97CdF0496a54E0e5896',
    AgentRegistry: '0x46d0b147E6D0898CE244Ba0F947e0eF2eB31747F',
    AllocationManager: '0x71C3E2237B4f5b19145ddf793B9DaAADFA13E165',
    VaultFactory: '0x6cD7bcb461293B23cDac87Ba4f8dBC2565b3B965',
    PositionManager: '0x6C3116EcE1A10bF0418603D2949834deEB3a3f30',
    TradeRouter: '0xADaf3a37fFDC10447356E131DC316509c44885D2',
    TradeRouterLens: '0x62272B653a128e2d5786Ae63C063157dfD3aa2bE',
    SwapAdapter: '0xBe12805faF4916791E1546457b67feb2952Ef298',
    GenesisVault: '0xa1291D77Eec59c1BE7dd30D0D7e50D659f1C5a84',
    tradingLogFromBlock: 276_471_279n,
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
    GenesisVault: null,
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
