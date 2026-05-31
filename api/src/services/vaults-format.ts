import type { ListVaultsResult } from "../types/vault.js";

/** Human-readable markdown for LLMs and chat tools that prefer plain text. */
export function formatVaultsMarkdown(data: ListVaultsResult): string {
  const lines = [
    "# AlphaGrid vaults",
    "",
    `Total: ${data.total}`,
    "",
  ];

  for (const vault of data.vaults) {
    lines.push(`## ${vault.name} (\`${vault.id}\`)`);
    lines.push("");
    lines.push(`- **Tagline:** ${vault.tagline}`);
    lines.push(`- **TVL (USD):** $${vault.tvlUsd.toLocaleString("en-US")}`);
    lines.push(`- **TVL 24h change:** ${vault.tvlChange24hPct}%`);
    lines.push(`- **Agents:** ${vault.agentCount}`);
    lines.push(`- **Return YTD:** ${vault.returnYtdPct}%`);
    lines.push(`- **Chain ID:** ${vault.chainId}`);
    lines.push(`- **Contract:** \`${vault.contractAddress}\``);
    lines.push("");
    lines.push(vault.description);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
