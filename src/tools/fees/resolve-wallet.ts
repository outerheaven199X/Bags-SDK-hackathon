/** bags_resolve_wallet — Resolve a social handle to a Bags.fm Solana wallet. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsGet } from "../../client/bags-rest.js";
import { cache, CACHE_TTL } from "../../client/cache.js";
import { mcpError } from "../../utils/errors.js";
import type { FeeShareWalletResponse } from "../../client/types.js";

const inputSchema = {
  provider: z.enum([
    "twitter", "tiktok", "kick", "instagram", "onlyfans",
    "github", "apple", "google", "email", "solana", "moltbook",
  ]).describe("Social platform provider"),
  username: z.string().describe("Username on that platform (without @ prefix)"),
};

/**
 * Register the bags_resolve_wallet tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerResolveWallet(server: McpServer) {
  server.tool(
    "bags_resolve_wallet",
    "Resolve a social media username to their Bags.fm Solana wallet address. Supports Twitter, TikTok, Kick, Instagram, GitHub, and more. Essential for building fee configs with social handles instead of raw wallet addresses.",
    inputSchema,
    async ({ provider, username }) => {
      try {
        const cacheKey = `resolve:${provider}:${username}`;
        const cached = cache.get<FeeShareWalletResponse>(cacheKey);
        if (cached) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify(cached, null, 2) }],
          };
        }

        const result = await bagsGet<FeeShareWalletResponse>("/token-launch/fee-share/wallet/v2", {
          provider,
          username,
        });

        if (!result.success) {
          return mcpError(new Error(result.error ?? `Could not resolve ${provider}/${username}`));
        }

        cache.set(cacheKey, result.response, CACHE_TTL.immutable);

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result.response, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
