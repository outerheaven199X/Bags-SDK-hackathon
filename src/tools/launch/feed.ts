/** bags_launch_feed — Fetch the live token launch feed from Bags.fm. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsGet } from "../../client/bags-rest.js";
import { cache, CACHE_TTL } from "../../client/cache.js";
import { mcpError } from "../../utils/errors.js";

const CACHE_KEY = "launch-feed";

const inputSchema = {
  limit: z.number().optional().describe("Number of launches to return (default 20)"),
  offset: z.number().optional().describe("Pagination offset"),
};

/**
 * Register the bags_launch_feed tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerLaunchFeed(server: McpServer) {
  server.tool(
    "bags_launch_feed",
    "Get the live token launch feed from Bags.fm. Shows recent and active launches with their status, metadata, creator info, and pool keys. Use this to discover new tokens.",
    inputSchema,
    async ({ limit, offset }) => {
      try {
        const cacheKey = `${CACHE_KEY}:${limit ?? 20}:${offset ?? 0}`;
        const cached = cache.get<unknown>(cacheKey);
        if (cached) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify(cached, null, 2) }],
          };
        }

        const params: Record<string, string> = {};
        if (limit !== undefined) params.limit = String(limit);
        if (offset !== undefined) params.offset = String(offset);

        const result = await bagsGet<unknown>("/token-launch/feed", params);
        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to fetch launch feed"));
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
