/** bags_lifetime_fees — Get total lifetime trading fees for a token. */

import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getBagsSDK } from "../../client/bags-sdk-wrapper.js";
import { cache, CACHE_TTL } from "../../client/cache.js";
import { mcpError } from "../../utils/errors.js";
import { lamportsToSol } from "../../utils/formatting.js";

const inputSchema = {
  tokenMint: z.string().describe("Base58-encoded Solana token mint address"),
};

/**
 * Register the bags_lifetime_fees tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerLifetimeFees(server: McpServer) {
  server.tool(
    "bags_lifetime_fees",
    "Total trading fees collected for a token on Bags.fm, in both lamports and SOL. Use this to evaluate fee revenue performance of any token.",
    inputSchema,
    async ({ tokenMint }) => {
      try {
        const cacheKey = `lifetime-fees:${tokenMint}`;
        const cached = cache.get<string>(cacheKey);

        let feesLamports: string;
        if (cached) {
          feesLamports = cached;
        } else {
          const sdk = getBagsSDK();
          const result = await sdk.state.getTokenLifetimeFees(new PublicKey(tokenMint));
          feesLamports = String(result);
          cache.set(cacheKey, feesLamports, CACHE_TTL.moderate);
        }

        const output = {
          tokenMint,
          lifetimeFeesLamports: feesLamports,
          lifetimeFeesSol: lamportsToSol(feesLamports),
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
