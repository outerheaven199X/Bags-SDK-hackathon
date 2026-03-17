/** bags_claim_events — Fetch fee claim event history for a token. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsGet } from "../../client/bags-rest.js";
import { cache, CACHE_TTL } from "../../client/cache.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  tokenMint: z.string().describe("Base58 token mint address"),
  mode: z.enum(["offset", "time"]).optional().describe("Pagination mode: 'offset' or 'time' (default offset)"),
  limit: z.number().optional().describe("Number of events to return (offset mode, default 20)"),
  offset: z.number().optional().describe("Pagination offset (offset mode)"),
  from: z.number().optional().describe("Start Unix timestamp (time mode)"),
  to: z.number().optional().describe("End Unix timestamp (time mode)"),
};

/**
 * Register the bags_claim_events tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerClaimEvents(server: McpServer) {
  server.tool(
    "bags_claim_events",
    "Fetch fee claim event history for a token. Supports both offset pagination and time-range queries. Useful for auditing fee distributions and tracking claim activity.",
    inputSchema,
    async ({ tokenMint, mode, limit, offset, from, to }) => {
      try {
        const params: Record<string, string> = { tokenMint };
        if (mode) params.mode = mode;
        if (limit !== undefined) params.limit = String(limit);
        if (offset !== undefined) params.offset = String(offset);
        if (from !== undefined) params.from = String(from);
        if (to !== undefined) params.to = String(to);

        const cacheKey = `claim-events:${JSON.stringify(params)}`;
        const cached = cache.get<unknown>(cacheKey);
        if (cached) {
          return { content: [{ type: "text" as const, text: JSON.stringify(cached, null, 2) }] };
        }

        const result = await bagsGet<unknown>("/fee-share/token/claim-events", params);
        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to fetch claim events"));
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
