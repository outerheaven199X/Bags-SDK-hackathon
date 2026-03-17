/** MCP Prompt: Fee earnings analysis for a token or wallet. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const argsSchema = {
  target: z.string().describe("Token mint OR wallet address to analyze"),
  targetType: z.enum(["token", "wallet"]).describe("Whether the target is a 'token' mint or a 'wallet' address"),
};

/**
 * Register the bags_analyze_fees prompt on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerAnalyzeFeesPrompt(server: McpServer) {
  server.prompt(
    "bags_analyze_fees",
    "Analyze fee earnings for a token or wallet on Bags.fm.",
    argsSchema,
    ({ target, targetType }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Analyze fee earnings on Bags.fm for ${targetType} ${target}.

${targetType === "token" ? `STEPS:
1. Call bags_lifetime_fees with tokenMint=${target}.
2. Call bags_claim_events with tokenMint=${target}.
3. Call bags_token_creators with tokenMint=${target}.
4. Call bags_claim_stats with tokenMint=${target}.` : `STEPS:
1. Call bags_claimable_positions with walletAddress=${target}.
2. Call bags_claim_stats with walletAddress=${target}.`}

Summarize: total earned, total unclaimed, claim frequency, and recommendations.`,
        },
      }],
    }),
  );
}
