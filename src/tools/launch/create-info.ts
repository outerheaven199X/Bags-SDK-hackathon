/** bags_create_token_info — Create token metadata (name, symbol, image) on Bags.fm. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getBagsSDK } from "../../client/bags-sdk-wrapper.js";
import { mcpError } from "../../utils/errors.js";
import {
  TOKEN_NAME_MAX_LENGTH,
  TOKEN_SYMBOL_MAX_LENGTH,
  TOKEN_DESCRIPTION_MAX_LENGTH,
} from "../../utils/constants.js";
import type { CreateTokenInfoResponse } from "../../client/types.js";

const inputSchema = {
  name: z.string().max(TOKEN_NAME_MAX_LENGTH).describe("Token name (max 32 chars)"),
  symbol: z.string().max(TOKEN_SYMBOL_MAX_LENGTH).describe("Token symbol (max 10 chars, auto-uppercased)"),
  description: z.string().max(TOKEN_DESCRIPTION_MAX_LENGTH).describe("Token description (max 1000 chars)"),
  imageUrl: z.string().url().describe("Public URL for the token image"),
  telegram: z.string().optional().describe("Telegram group URL"),
  twitter: z.string().optional().describe("Twitter/X profile URL"),
  website: z.string().optional().describe("Project website URL"),
};

/**
 * Register the bags_create_token_info tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerCreateTokenInfo(server: McpServer) {
  server.tool(
    "bags_create_token_info",
    "Create token metadata on Bags.fm: uploads name, symbol, description, and image to IPFS. Returns the tokenMint and metadata URI needed for the launch transaction. This is step 1 of a token launch.",
    inputSchema,
    async ({ name, symbol, description, imageUrl, telegram, twitter, website }) => {
      try {
        const sdk = getBagsSDK();
        const result = await sdk.tokenLaunch.createTokenInfoAndMetadata({
          name,
          symbol: symbol.toUpperCase(),
          description,
          imageUrl,
          telegram: telegram ?? undefined,
          twitter: twitter ?? undefined,
          website: website ?? undefined,
        });

        const uri = result.tokenLaunch.uri || result.tokenMetadata;
        const output = {
          tokenMint: result.tokenMint,
          tokenMetadata: result.tokenMetadata,
          uri,
          status: result.tokenLaunch.status,
          nextStep: "Use bags_create_fee_config with this tokenMint, then bags_create_launch_tx with the URI and configKey.",
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
