import {
  createPublicClient,
  createWalletClient,
  http,
  type Chain,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as viemChains from "viem/chains";
import type { AgentRegistrationConfig } from "../lib/agent-registration-config.js";

const SUPPORTED_CHAINS = [viemChains.mainnet];

function resolveChain(chainId: number, rpcUrl: string): Chain {
  const supportedChain = SUPPORTED_CHAINS.find((chain) => chain.id === chainId);
  if (!supportedChain) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  return {
    ...supportedChain,
    rpcUrls: {
      ...supportedChain.rpcUrls,
      default: { http: [rpcUrl] },
    },
  };
}

export class ProviderService {
  readonly chain: Chain;

  constructor(
    private readonly rpcUrl: string,
    chainId: number,
  ) {
    this.chain = resolveChain(chainId, rpcUrl);
  }

  static fromConfig(config: AgentRegistrationConfig): ProviderService {
    if (!config.rpcUrl) {
      throw new Error("RPC_URL is not configured");
    }
    return new ProviderService(config.rpcUrl, config.chainId);
  }

  createPublicClient() {
    return createPublicClient({
      chain: this.chain,
      transport: http(this.rpcUrl),
    });
  }

  createWalletClient(privateKey: Hex) {
    return createWalletClient({
      account: privateKeyToAccount(privateKey),
      chain: this.chain,
      transport: http(this.rpcUrl),
    });
  }
}
