/** bags_pool — Get detailed info for a specific pool by token mint via REST API. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsGet } from "../../client/bags-rest.js";
import { cache, CACHE_TTL } from "../../client/cache.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  tokenMint: z.string().describe("Base58 token mint address"),
};

/**
 * Register the bags_pool tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerPool(server: McpServer) {
  server.tool(
    "bags_pool",
    "Get detailed information for a specific Bags.fm liquidity pool by token mint. Returns pool address, reserves, fee config, and migration status.",
    inputSchema,
    async ({ tokenMint }) => {
      try {
        const cacheKey = `pool:${tokenMint}`;
        const cached = cache.get<unknown>(cacheKey);
        if (cached) {
          return { content: [{ type: "text" as const, text: JSON.stringify(cached, null, 2) }] };
        }

        const result = await bagsGet<unknown>(`/pools/${tokenMint}`);
        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to fetch pool"));
        }

        cache.set(cacheKey, result.response, CACHE_TTL.moderate);

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result.response, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
