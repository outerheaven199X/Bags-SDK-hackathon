/** bags_top_tokens — Get the top tokens ranked by lifetime trading fees. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getBagsSDK } from "../../client/bags-sdk-wrapper.js";
import { cache, CACHE_TTL } from "../../client/cache.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {};

/**
 * Register the bags_top_tokens tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerTopTokens(server: McpServer) {
  server.tool(
    "bags_top_tokens",
    "Get the leaderboard of top Bags.fm tokens ranked by lifetime trading fees collected. Useful for discovering the most actively traded tokens on the platform.",
    inputSchema,
    async () => {
      try {
        const cacheKey = "top-tokens";
        const cached = cache.get<unknown>(cacheKey);
        if (cached) {
          return { content: [{ type: "text" as const, text: JSON.stringify(cached, null, 2) }] };
        }

        const sdk = getBagsSDK();
        const topTokens = await sdk.state.getTopTokensByLifetimeFees();

        cache.set(cacheKey, topTokens, CACHE_TTL.moderate);

        return {
          content: [{ type: "text" as const, text: JSON.stringify(topTokens, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
