/** MCP Prompt: Batch fee claiming workflow. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const argsSchema = {
  walletAddress: z.string().describe("Your Base58 Solana wallet address"),
  minClaimSol: z.string().default("0.001").describe("Minimum SOL threshold to claim (skip dust)"),
};

/**
 * Register the bags_claim_all prompt on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerClaimAllPrompt(server: McpServer) {
  server.prompt(
    "bags_claim_all",
    "Claim all accumulated trading fees across all your Bags.fm positions at once.",
    argsSchema,
    ({ walletAddress, minClaimSol }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Claim all fees for wallet ${walletAddress} on Bags.fm.

STEPS:
1. Call bags_claimable_positions to see all positions with unclaimed fees.
2. Filter out positions below ${minClaimSol} SOL.
3. Show summary: position count, total claimable SOL, per-token breakdown.
4. Call bags_claim_all_fees with minClaimLamports=${Number(minClaimSol) * 1e9}.
5. Return unsigned transactions to sign in order.`,
        },
      }],
    }),
  );
}
