/** bags_partner_config — Create or retrieve a partner config. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsPost } from "../../client/bags-rest.js";
import { cache, CACHE_TTL } from "../../client/cache.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  partnerWallet: z.string().describe("Base58 wallet address for the partner"),
  feeBps: z.number().optional().describe("Partner fee in BPS (default 2500 = 25%)"),
};

/**
 * Register the bags_partner_config tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerPartnerConfig(server: McpServer) {
  server.tool(
    "bags_partner_config",
    "Create or retrieve a Bags.fm partner configuration. Partners earn a percentage of trading fees from tokens launched through their config. Default fee is 25% (2500 BPS).",
    inputSchema,
    async ({ partnerWallet, feeBps }) => {
      try {
        const cacheKey = `partner-config:${partnerWallet}`;
        const cached = cache.get<unknown>(cacheKey);
        if (cached) {
          return { content: [{ type: "text" as const, text: JSON.stringify(cached, null, 2) }] };
        }

        const result = await bagsPost<unknown>("/partner/config", {
          partnerWallet,
          feeBps: feeBps ?? 2500,
        });

        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to create/get partner config"));
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
