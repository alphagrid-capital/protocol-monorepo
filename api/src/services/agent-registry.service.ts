import { decodeEventLog, type Address, type Hex } from "viem";
import { agentRegistryAbi } from "./abis/agent-registry.js";
import { ProviderService } from "./provider.service.js";
import type { SelfRegisterTypedData } from "../lib/eip712-agent-registration.js";

export class AgentRegistryService {
  constructor(
    private readonly providerService: ProviderService,
    private readonly registryAddress: Address,
  ) {}

  async getSignerNonce(signer: Address): Promise<bigint> {
    const client = this.providerService.createPublicClient();
    return client.readContract({
      address: this.registryAddress,
      abi: agentRegistryAbi,
      functionName: "nonces",
      args: [signer],
    });
  }

  async getEip712Domain(): Promise<{ name: string; version: string }> {
    const client = this.providerService.createPublicClient();
    const [, name, version] = await client.readContract({
      address: this.registryAddress,
      abi: agentRegistryAbi,
      functionName: "eip712Domain",
    });
    return { name, version };
  }

  async registerWithRelayer(
    relayerPrivateKey: Hex,
    data: SelfRegisterTypedData,
  ): Promise<{ agentId: string; transactionHash: Hex }> {
    const publicClient = this.providerService.createPublicClient();
    const walletClient = this.providerService.createWalletClient(relayerPrivateKey);

    const transactionHash = await walletClient.writeContract({
      address: this.registryAddress,
      abi: agentRegistryAbi,
      functionName: "registerAgent",
      args: [
        data.signer,
        data.vault,
        data.name,
        data.metadataURI,
        data.signer,
        data.linkERC8004,
        data.erc8004AgentId,
      ],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
    if (receipt.status !== "success") {
      throw new Error("On-chain registration transaction reverted");
    }

    let agentId: bigint | null = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== this.registryAddress.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({
          abi: agentRegistryAbi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "AgentRegistered") {
          agentId = decoded.args.agentId;
          break;
        }
      } catch {
        // unrelated log
      }
    }

    if (agentId === null) {
      throw new Error("AgentRegistered event not found in receipt");
    }

    return { agentId: agentId.toString(), transactionHash };
  }
}
