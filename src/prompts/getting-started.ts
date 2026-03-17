/** MCP Prompt: Interactive onboarding for new Bags SDK users. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const argsSchema = {
  wallet: z.string().optional().describe("User's Solana wallet address (if known)"),
};

/**
 * Register the bags_getting_started prompt on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerGettingStartedPrompt(server: McpServer) {
  server.prompt(
    "bags_getting_started",
    "Interactive onboarding — shows what Bags SDK can do and helps the user pick a starting point.",
    argsSchema,
    ({ wallet }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Welcome me to the Bags SDK MCP server and help me get started.
${wallet ? `My wallet is: ${wallet}` : "I haven't provided my wallet yet."}

Walk me through what's available in a friendly, concise way. Offer these options:

1. **Launch a token** — I want to create and launch a new Solana token on Bags.fm.
   Ask me for: name, symbol, description, image, wallet, fee split, initial buy amount.

2. **Check my portfolio** — Show my wallet balance, token holdings, and any unclaimed fees.
   ${wallet ? `Use bags_wallet_balance and bags_claimable_positions for wallet ${wallet}.` : "Ask for my wallet address first."}

3. **Browse recent launches** — Show me what tokens were just launched on Bags.fm.
   Use bags_launch_feed to display the latest launches.

4. **Explore analytics** — Show top tokens, fee leaderboards, or look up a specific token.
   Use bags_top_tokens or bags_claim_stats.

5. **(Advanced) Build a custom tool** — I need something not in the standard toolkit.
   Offer to scaffold a new MCP tool using the Bags SDK services.

Present these as a numbered menu. Wait for my choice, then guide me step by step.
Keep it conversational and beginner-friendly. Don't dump all the technical details up front.`,
        },
      }],
    }),
  );
}
