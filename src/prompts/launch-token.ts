/** MCP Prompt: Guided solo token launch workflow. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const argsSchema = {
  tokenName: z.string().describe("Token name (max 32 chars)"),
  tokenSymbol: z.string().describe("Token symbol (max 10 chars)"),
  tokenDescription: z.string().describe("Token description"),
  imageUrl: z.string().optional().describe("Public URL for token image, or a text description to generate one"),
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
          text: `The user wants to launch a token on Bags.fm. Here are the details they provided:

  Name: ${tokenName}
  Symbol: $${tokenSymbol}
  Description: ${tokenDescription}
  Image: ${imageUrl || "(not provided yet)"}
  Wallet: ${creatorWallet}
  Fee split: 100% to creator
  Initial buy: ${initialBuySol} SOL

**Image handling:**
- If the image field is a URL (starts with http), use it directly.
- If it is a text description or empty, offer to generate an image. Use image generation tools if available, show the result, and iterate until the user is happy. Only proceed once they approve the image.

Show them this summary in a clean format and ask: "Does this look right?"

If they confirm, execute these steps silently (do NOT narrate each tool call):
  1. bags_resolve_wallet for the creator wallet
  2. bags_create_token_info with the token details
  3. bags_create_fee_config with payer=${creatorWallet}, baseMint from step 2, 100% to creator
  4. bags_create_launch_tx with URI + tokenMint from step 2, configKey from step 3, initialBuyLamports = ${initialBuySol} * 1e9

Then return all unsigned transactions and tell them to sign in their wallet.
If any step fails, explain the error in plain language — no tool names, no jargon.`,
        },
      }],
    }),
  );
}
