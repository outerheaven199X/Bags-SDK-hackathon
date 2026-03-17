/** MCP Prompt: Guided solo token launch workflow. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const argsSchema = {
  tokenName: z.string().describe("Token name (max 32 chars)"),
  tokenSymbol: z.string().describe("Token symbol (max 10 chars)"),
  tokenDescription: z.string().describe("Token description"),
  imageUrl: z.string().describe("Public URL for token image"),
  creatorWallet: z.string().describe("Creator's Base58 Solana wallet"),
  initialBuySol: z.string().default("0").describe("Initial buy in SOL (optional)"),
};

/**
 * Register the bags_launch_token prompt on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerLaunchTokenPrompt(server: McpServer) {
  server.prompt(
    "bags_launch_token",
    "Guided workflow to launch a token on Bags.fm with a solo fee config.",
    argsSchema,
    ({ tokenName, tokenSymbol, tokenDescription, imageUrl, creatorWallet, initialBuySol }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Launch a solo token on Bags.fm. Follow these steps exactly:

TOKEN: ${tokenName} ($${tokenSymbol})
DESCRIPTION: ${tokenDescription}
IMAGE: ${imageUrl}
CREATOR: ${creatorWallet}
INITIAL BUY: ${initialBuySol} SOL

STEPS:
1. Call bags_resolve_wallet for the creator to get their Bags wallet.
2. Call bags_compose_fee_config with mode=template, template=solo, and the creator info.
3. Call bags_create_token_info with the token details.
4. Call bags_create_fee_config with payer=${creatorWallet}, baseMint from step 3, and 100% to the creator.
5. Call bags_create_launch_tx with the URI from step 3, tokenMint from step 3, configKey from step 4, and initialBuyLamports=${initialBuySol}*1e9.
6. Return all unsigned transactions to sign.`,
        },
      }],
    }),
  );
}
