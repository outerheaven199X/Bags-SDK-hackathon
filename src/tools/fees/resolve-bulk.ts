/** bags_resolve_wallets_bulk — Resolve multiple social handles to wallets in one call. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsGet } from "../../client/bags-rest.js";
import { cache, CACHE_TTL } from "../../client/cache.js";
import { mcpError } from "../../utils/errors.js";
import type { FeeShareWalletResponse, SupportedProvider } from "../../client/types.js";

const inputSchema = {
  entries: z.array(z.object({
    provider: z.enum([
      "twitter", "tiktok", "kick", "instagram", "onlyfans",
      "github", "apple", "google", "email", "solana", "moltbook",
    ]),
    username: z.string(),
  })).describe("Array of {provider, username} pairs to resolve"),
};

/**
 * Register the bags_resolve_wallets_bulk tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerResolveWalletsBulk(server: McpServer) {
  server.tool(
    "bags_resolve_wallets_bulk",
    "Resolve multiple social handles to Bags.fm wallets in a single call. Returns an array of resolved wallets in the same order as the input. Failed resolutions include error details.",
    inputSchema,
    async ({ entries }) => {
      try {
        const results = await Promise.allSettled(
          entries.map(async ({ provider, username }) => {
            const cacheKey = `resolve:${provider}:${username}`;
            const cached = cache.get<FeeShareWalletResponse>(cacheKey);
            if (cached) return { ...cached, _source: "cache" as const };

            const result = await bagsGet<FeeShareWalletResponse>("/fee-share/resolve-wallet", {
              provider,
              username,
            });

            if (!result.success) {
              throw new Error(result.error ?? `Could not resolve ${provider}/${username}`);
            }

            cache.set(cacheKey, result.response, CACHE_TTL.immutable);
            return { ...result.response!, _source: "api" as const };
          }),
        );

        const output = results.map((r, i) => {
          if (r.status === "fulfilled") {
            return { input: entries[i], resolved: true, ...r.value };
          }
          return { input: entries[i], resolved: false, error: r.reason?.message ?? "Unknown error" };
        });

        return {
          content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
