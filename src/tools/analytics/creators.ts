/** bags_token_creators — Get creator info for a token. */

import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getBagsSDK } from "../../client/bags-sdk-wrapper.js";
import { cache, CACHE_TTL } from "../../client/cache.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  tokenMint: z.string().describe("Base58 token mint address"),
};

/**
 * Register the bags_token_creators tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerTokenCreators(server: McpServer) {
  server.tool(
    "bags_token_creators",
    "Get creator information for a Bags.fm token including wallet addresses, social profiles, and launch history. Useful for due diligence before trading.",
    inputSchema,
    async ({ tokenMint }) => {
      try {
        const cacheKey = `creators:${tokenMint}`;
        const cached = cache.get<unknown>(cacheKey);
        if (cached) {
          return { content: [{ type: "text" as const, text: JSON.stringify(cached, null, 2) }] };
        }

        const sdk = getBagsSDK();
        const creators = await sdk.state.getTokenCreators(new PublicKey(tokenMint));

        cache.set(cacheKey, creators, CACHE_TTL.stable);

        return {
          content: [{ type: "text" as const, text: JSON.stringify(creators, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
