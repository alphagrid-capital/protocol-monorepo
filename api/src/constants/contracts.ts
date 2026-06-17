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
    FeeManager: '0x0cFa6B475713689DaEe8630f0579e3Ca80dAd188',
    VaultTrackRegistry: '0x82b30f1DC58b581837d80a602823410C948BaA83',
    TokenRegistry: '0x1bE709E35016D5329FfF205D7421fa6571e640f2',
    PriceOracle: '0x2B973C8a9Ba80209579E1dEa3671FDb6C1323a02',
    AgentRegistry: '0x0058D81cF44dfe2a35a06e5D1F0760a6b2985900',
    AllocationManager: '0xC0F8Eaf50a2eBed44aea3eC8dd05c087D49A5308',
    VaultFactory: '0x78aAa82b6AAc9ED9bcbB1973531874B92Dc20C8c',
    PositionManager: '0x852df17f4aB66aaDC45e8ec0EE1EdbefdeB384c3',
    TradeRouter: '0xb78f0EAdAF1D6209D73a3C5eb8203f0cb3a6ccba',
    TradeRouterLens: '0xB9acd4CeB37FF72260aE2f3721f19D602d07d02C',
    SwapAdapter: '0xDb74cb1308460e68eB8a0F83A1e61A89D58259bd',
    GenesisVault: '0x02D1405597bf1c7B9B7D5d0057119b66c02bc785',
    tradingLogFromBlock: 473_518_588n,
    feeAsset: {
      address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
    vaultAsset: {
      address: '0xF0C7eC2cc2866F482009818F1Ea343d6e7f181e9',
      symbol: 'mSTBL',
      name: 'Mocked Stable',
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
    FeeManager: '0x0cFa6B475713689DaEe8630f0579e3Ca80dAd188',
    VaultTrackRegistry: '0x82b30f1DC58b581837d80a602823410C948BaA83',
    TokenRegistry: '0x1bE709E35016D5329FfF205D7421fa6571e640f2',
    PriceOracle: '0x2B973C8a9Ba80209579E1dEa3671FDb6C1323a02',
    AgentRegistry: '0x0058D81cF44dfe2a35a06e5D1F0760a6b2985900',
    AllocationManager: '0xC0F8Eaf50a2eBed44aea3eC8dd05c087D49A5308',
    VaultFactory: '0x78aAa82b6AAc9ED9bcbB1973531874B92Dc20C8c',
    PositionManager: '0x852df17f4aB66aaDC45e8ec0EE1EdbefdeB384c3',
    TradeRouter: '0xb78f0EAdAF1D6209D73a3C5eb8203f0cb3a6ccba',
    TradeRouterLens: '0xB9acd4CeB37FF72260aE2f3721f19D602d07d02C',
    SwapAdapter: '0xDb74cb1308460e68eB8a0F83A1e61A89D58259bd',
    GenesisVault: '0x02D1405597bf1c7B9B7D5d0057119b66c02bc785',
    feeAsset: {
      address: '0x7E955252E15c84f5768B83c41a71F9eba181802F',
      symbol: 'USDG',
      name: 'USDG',
      decimals: 6,
    },
    vaultAsset: {
      address: '0xF0C7eC2cc2866F482009818F1Ea343d6e7f181e9',
      symbol: 'mSTBL',
      name: 'Mocked Stable',
      decimals: 6,
    },
  },
}
