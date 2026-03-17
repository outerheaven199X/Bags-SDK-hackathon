/** bags_partner_stats — Get partner fee statistics. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsGet } from "../../client/bags-rest.js";
import { cache, CACHE_TTL } from "../../client/cache.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  partnerWallet: z.string().describe("Base58 partner wallet address"),
};

/**
 * Register the bags_partner_stats tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerPartnerStats(server: McpServer) {
  server.tool(
    "bags_partner_stats",
    "Get fee earning statistics for a Bags.fm partner. Shows total fees earned, tokens using the partner config, and claim history.",
    inputSchema,
    async ({ partnerWallet }) => {
      try {
        const cacheKey = `partner-stats:${partnerWallet}`;
        const cached = cache.get<unknown>(cacheKey);
        if (cached) {
          return { content: [{ type: "text" as const, text: JSON.stringify(cached, null, 2) }] };
        }

        const result = await bagsGet<unknown>("/partner/stats", { wallet: partnerWallet });
        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to fetch partner stats"));
        }

        cache.set(cacheKey, result.response, CACHE_TTL.stable);

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result.response, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
