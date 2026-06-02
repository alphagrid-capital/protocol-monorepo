import {
  createPublicClient,
  createWalletClient,
  http,
  type Chain,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { AgentRegistrationConfig } from "../config/agent-registration.js";

export class ProviderService {
  readonly chain: Chain;

  constructor(
    private readonly rpcUrl: string,
    chainId: number,
  ) {
    this.chain = {
      id: chainId,
      name: "alphagrid",
      nativeCurrency: { decimals: 18, name: "ETH", symbol: "ETH" },
      rpcUrls: { default: { http: [rpcUrl] } },
    };
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
