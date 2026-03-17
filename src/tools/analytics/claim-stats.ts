/** bags_claim_stats — Get claim statistics for a wallet or token. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsGet } from "../../client/bags-rest.js";
import { cache, CACHE_TTL } from "../../client/cache.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  walletAddress: z.string().optional().describe("Base58 wallet address to get claim stats for"),
  tokenMint: z.string().optional().describe("Base58 token mint to get claim stats for"),
};

/**
 * Register the bags_claim_stats tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerClaimStats(server: McpServer) {
  server.tool(
    "bags_claim_stats",
    "Get fee claim statistics for a wallet or token. Shows total claimed, total unclaimed, claim count, and historical trends. Provide either walletAddress, tokenMint, or both.",
    inputSchema,
    async ({ walletAddress, tokenMint }) => {
      try {
        if (!walletAddress && !tokenMint) {
          return mcpError(new Error("Provide at least walletAddress or tokenMint."));
        }

        const params: Record<string, string> = {};
        if (walletAddress) params.wallet = walletAddress;
        if (tokenMint) params.tokenMint = tokenMint;

        const cacheKey = `claim-stats:${walletAddress ?? ""}:${tokenMint ?? ""}`;
        const cached = cache.get<unknown>(cacheKey);
        if (cached) {
          return { content: [{ type: "text" as const, text: JSON.stringify(cached, null, 2) }] };
        }

        const result = await bagsGet<unknown>("/fee-share/claim-stats", params);
        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to fetch claim stats"));
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
