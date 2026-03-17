/** bags_pools — List all active liquidity pools on Bags.fm via REST API. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsGet } from "../../client/bags-rest.js";
import { cache, CACHE_TTL } from "../../client/cache.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {};

/**
 * Register the bags_pools tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerPools(server: McpServer) {
  server.tool(
    "bags_pools",
    "List all active liquidity pools on Bags.fm with their token mints, migration status, and pool addresses. Cached for 5 minutes.",
    inputSchema,
    async () => {
      try {
        const cacheKey = "pools:all";
        const cached = cache.get<unknown>(cacheKey);
        if (cached) {
          return { content: [{ type: "text" as const, text: JSON.stringify(cached, null, 2) }] };
        }

        const result = await bagsGet<unknown>("/pools");
        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to fetch pools"));
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
