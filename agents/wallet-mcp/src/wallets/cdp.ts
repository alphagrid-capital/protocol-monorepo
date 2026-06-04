import {
  AgentKit,
  cdpApiActionProvider,
  cdpSmartWalletActionProvider,
  erc20ActionProvider,
  pythActionProvider,
  CdpSmartWalletProvider,
  walletActionProvider,
  wethActionProvider,
  x402ActionProvider,
  ActionProvider,
} from "@coinbase/agentkit";

function assertCdpEnv(): void {
  const required = [
    "CDP_API_KEY_ID",
    "CDP_API_KEY_SECRET",
    "CDP_WALLET_SECRET",
  ] as const;
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `CDP wallet requires: ${missing.join(", ")}. Set WALLET_PROVIDER=viem to use a local key instead.`,
    );
  }
}

export async function createAgentKitWithCdp(): Promise<AgentKit> {
  assertCdpEnv();

  try {
    const walletProvider = await CdpSmartWalletProvider.configureWithWallet({
      apiKeyId: process.env.CDP_API_KEY_ID,
      apiKeySecret: process.env.CDP_API_KEY_SECRET,
      walletSecret: process.env.CDP_WALLET_SECRET,
      networkId: process.env.NETWORK_ID || "base-sepolia",
      address: process.env.ADDRESS as `0x${string}` | undefined,
      owner: process.env.OWNER_ADDRESS as `0x${string}` | undefined,
      paymasterUrl: process.env.PAYMASTER_URL,
      rpcUrl: process.env.RPC_URL,
      idempotencyKey: process.env.IDEMPOTENCY_KEY,
    });

    const actionProviders: ActionProvider[] = [
      wethActionProvider(), // Un/Wrap ETH → WETH
      pythActionProvider(), // Get price from Pyth (by symbol, by feed ID)
      walletActionProvider(), // Get wallet balance, nonce, etc.
      erc20ActionProvider(), // Get ERC20 token balance, approve, transfer, etc.
      cdpApiActionProvider(), // Get CDP API data (faucet, supported networks, etc.)
      cdpSmartWalletActionProvider(), // Get CDP Smart Wallet data (balance, nonce, etc.)
      x402ActionProvider(), // Execute x402 payments
    ];

    return AgentKit.from({
      walletProvider, // Get address, network, native ETH/SOL balance, etc.
      actionProviders,
    });
  } catch (error) {
    console.error("Error initializing CDP agent:", error);
    throw new Error("Failed to initialize CDP agent");
  }
}
