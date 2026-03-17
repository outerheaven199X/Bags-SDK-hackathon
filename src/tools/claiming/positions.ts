/** bags_claimable_positions — List all claimable fee positions for a wallet. */

import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getBagsSDK } from "../../client/bags-sdk-wrapper.js";
import { cache, CACHE_TTL } from "../../client/cache.js";
import { mcpError } from "../../utils/errors.js";
import { lamportsToSol } from "../../utils/formatting.js";

const inputSchema = {
  walletAddress: z.string().describe("Base58 wallet address to check positions for"),
};

/**
 * Register the bags_claimable_positions tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerClaimablePositions(server: McpServer) {
  server.tool(
    "bags_claimable_positions",
    "List all claimable fee positions for a wallet on Bags.fm. Shows each token's unclaimed fees in lamports and SOL. Use this to decide which positions to claim.",
    inputSchema,
    async ({ walletAddress }) => {
      try {
        const cacheKey = `positions:${walletAddress}`;
        const cached = cache.get<unknown>(cacheKey);
        if (cached) {
          return { content: [{ type: "text" as const, text: JSON.stringify(cached, null, 2) }] };
        }

        const sdk = getBagsSDK();
        const positions = await sdk.fee.getAllClaimablePositions(new PublicKey(walletAddress));

        const output = positions.map((p) => ({
          ...p,
          claimableSol: lamportsToSol(String(p.totalClaimableLamportsUserShare)),
        }));

        cache.set(cacheKey, output, CACHE_TTL.volatile);

        return {
          content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
