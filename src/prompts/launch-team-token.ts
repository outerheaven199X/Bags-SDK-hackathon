/** MCP Prompt: Guided team token launch with multi-party fee splits. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const argsSchema = {
  tokenName: z.string().describe("Token name (max 32 chars)"),
  tokenSymbol: z.string().describe("Token symbol (max 10 chars)"),
  tokenDescription: z.string().describe("Token description (max 1000 chars)"),
  imageUrl: z.string().describe("Public URL for token image"),
  creatorWallet: z.string().describe("Creator's Base58 Solana wallet"),
  teamMembers: z.string().describe("Comma-separated 'platform:username:percentage' (e.g., 'twitter:alice:30,twitter:bob:20,twitter:DividendsBot:10'). Must sum to 100."),
  initialBuySol: z.string().default("0").describe("Initial buy amount in SOL"),
};

/**
 * Register the bags_launch_team_token prompt on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerLaunchTeamTokenPrompt(server: McpServer) {
  server.prompt(
    "bags_launch_team_token",
    "Guided workflow: resolve team wallets, compose fee config, create token, launch with multi-party fee splits.",
    argsSchema,
    ({ tokenName, tokenSymbol, tokenDescription, imageUrl, creatorWallet, teamMembers, initialBuySol }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Launch a team token on Bags.fm with fee sharing. Follow these steps exactly:

TOKEN: ${tokenName} ($${tokenSymbol})
DESCRIPTION: ${tokenDescription}
IMAGE: ${imageUrl}
CREATOR: ${creatorWallet}
INITIAL BUY: ${initialBuySol} SOL
TEAM: ${teamMembers}

STEPS:
1. Parse the team members. For each, call bags_resolve_wallet to get their Solana wallet.
2. Call bags_compose_fee_config with the resolved wallets and BPS (percentage * 100). Verify valid.
3. Call bags_create_token_info with the token details.
4. Call bags_create_fee_config with payer=${creatorWallet}, baseMint from step 3, claimersArray and basisPointsArray from step 2.
5. Call bags_create_launch_tx with URI from step 3, tokenMint from step 3, configKey from step 4, initialBuyLamports=${initialBuySol}*1e9.
6. Return ALL unsigned transactions from steps 4 and 5. Sign in order.
7. Optionally call bags_dexscreener_check for the new token.

If any step fails, report the exact error and which step failed.`,
        },
      }],
    }),
  );
}
