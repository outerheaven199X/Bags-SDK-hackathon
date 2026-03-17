/** MCP Prompt: Partner key setup workflow. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const argsSchema = {
  partnerWallet: z.string().describe("Partner's Base58 Solana wallet"),
  feeBps: z.string().default("2500").describe("Partner fee in BPS (default 2500 = 25%)"),
};

/**
 * Register the bags_setup_partner prompt on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerSetupPartnerPrompt(server: McpServer) {
  server.prompt(
    "bags_setup_partner",
    "Set up a Bags.fm partner configuration for earning referral fees.",
    argsSchema,
    ({ partnerWallet, feeBps }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Set up a Bags.fm partner config for wallet ${partnerWallet}.

STEPS:
1. Call bags_partner_config with partnerWallet=${partnerWallet} and feeBps=${feeBps}.
2. Call bags_partner_stats to check existing earnings.
3. Explain how to use the partner config when launching tokens.
4. Show the fee structure: ${Number(feeBps) / 100}% of trading fees go to the partner.`,
        },
      }],
    }),
  );
}
