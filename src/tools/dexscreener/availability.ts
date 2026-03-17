/** bags_dexscreener_check — Check Dexscreener boost availability for a token. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsGet } from "../../client/bags-rest.js";
import { cache, CACHE_TTL } from "../../client/cache.js";
import { mcpError } from "../../utils/errors.js";
import type { DexscreenerAvailabilityResponse } from "../../client/types.js";

const inputSchema = {
  tokenMint: z.string().describe("Base58 token mint address to check"),
};

/**
 * Register the bags_dexscreener_check tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerDexscreenerCheck(server: McpServer) {
  server.tool(
    "bags_dexscreener_check",
    "Check if Dexscreener profile boosting is available for a Bags.fm token and get the pricing. Dexscreener boosts increase token visibility on the Dexscreener aggregator.",
    inputSchema,
    async ({ tokenMint }) => {
      try {
        const cacheKey = `dex-avail:${tokenMint}`;
        const cached = cache.get<DexscreenerAvailabilityResponse>(cacheKey);
        if (cached) {
          return { content: [{ type: "text" as const, text: JSON.stringify(cached, null, 2) }] };
        }

        const result = await bagsGet<DexscreenerAvailabilityResponse>(
          "/dexscreener/availability",
          { tokenMint },
        );
        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to check Dexscreener availability"));
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
