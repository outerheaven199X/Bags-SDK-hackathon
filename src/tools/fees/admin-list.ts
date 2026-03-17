/** bags_fee_admin_list — List fee share configs administered by a wallet. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsGet } from "../../client/bags-rest.js";
import { cache, CACHE_TTL } from "../../client/cache.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  walletAddress: z.string().describe("Base58 wallet address of the fee share admin"),
};

/**
 * Register the bags_fee_admin_list tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerFeeAdminList(server: McpServer) {
  server.tool(
    "bags_fee_admin_list",
    "List all fee share configurations administered by a given wallet. Returns config details including token mints, claimer arrays, and BPS allocations.",
    inputSchema,
    async ({ walletAddress }) => {
      try {
        const cacheKey = `fee-admin:${walletAddress}`;
        const cached = cache.get<unknown>(cacheKey);
        if (cached) {
          return { content: [{ type: "text" as const, text: JSON.stringify(cached, null, 2) }] };
        }

        const result = await bagsGet<unknown>("/fee-share/admin/list", { wallet: walletAddress });
        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to list fee admin configs"));
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
