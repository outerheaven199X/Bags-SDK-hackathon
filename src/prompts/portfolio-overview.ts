/** MCP Prompt: Full portfolio + earnings summary. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const argsSchema = {
  walletAddress: z.string().describe("Your Base58 Solana wallet address"),
};

/**
 * Register the bags_portfolio_overview prompt on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerPortfolioOverviewPrompt(server: McpServer) {
  server.prompt(
    "bags_portfolio_overview",
    "Complete portfolio overview: SOL balance, holdings, claimable fees, and earnings.",
    argsSchema,
    ({ walletAddress }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Give me a full portfolio overview for wallet ${walletAddress}.

Run these in parallel where possible:
1. bags_wallet_balance — SOL balance
2. bags_token_holdings — all SPL token holdings
3. bags_claimable_positions — unclaimed fees
4. bags_claim_stats — historical claim data

Summarize: SOL balance, token count, total unclaimed fees, top 3 positions, total claimed, and whether to claim now.`,
        },
      }],
    }),
  );
}
