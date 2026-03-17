/** bags_resolve_wallets_bulk — Resolve multiple social handles to wallets via the bulk API. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsPost } from "../../client/bags-rest.js";
import { cache, CACHE_TTL } from "../../client/cache.js";
import { mcpError } from "../../utils/errors.js";
import type { SupportedProvider } from "../../client/types.js";

const PROVIDER_VALUES = [
  "twitter", "tiktok", "kick", "instagram", "onlyfans",
  "github", "apple", "google", "email", "solana", "moltbook",
] as const;

const inputSchema = {
  entries: z.array(z.object({
    provider: z.enum(PROVIDER_VALUES),
    username: z.string().min(1).max(100),
  })).min(1).max(100).describe("Array of {provider, username} pairs to resolve (max 100)"),
};

interface BulkResolveItem {
  username: string;
  provider: SupportedProvider;
  platformData: { id: string; username: string; display_name: string; avatar_url: string } | null;
  wallet: string | null;
}

/**
 * Register the bags_resolve_wallets_bulk tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerResolveWalletsBulk(server: McpServer) {
  server.tool(
    "bags_resolve_wallets_bulk",
    "Resolve multiple social handles to Bags.fm wallets in a single API call. Returns an array with wallet addresses (null if not found).",
    inputSchema,
    async ({ entries }) => {
      try {
        const items = entries.map(({ provider, username }) => ({ provider, username }));

        const result = await bagsPost<BulkResolveItem[]>(
          "/token-launch/fee-share/wallet/v2/bulk",
          { items },
        );

        if (!result.success) {
          return mcpError(new Error(result.error ?? "Bulk resolve failed"));
        }

        const resolved = result.response!;
        for (const item of resolved) {
          if (item.wallet) {
            cache.set(`resolve:${item.provider}:${item.username}`, item, CACHE_TTL.immutable);
          }
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(resolved, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
