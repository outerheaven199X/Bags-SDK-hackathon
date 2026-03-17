/** bags://portfolio/{wallet} — MCP Resource providing claimable positions + earnings. */

import { PublicKey } from "@solana/web3.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getBagsSDK } from "../client/bags-sdk-wrapper.js";
import { cache, CACHE_TTL } from "../client/cache.js";
import { lamportsToSol } from "../utils/formatting.js";

/**
 * Register the bags://portfolio/{wallet} resource template on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerPortfolioResource(server: McpServer) {
  server.resource(
    "portfolio",
    new ResourceTemplate("bags://portfolio/{wallet}", { list: undefined }),
    {
      description: "Full portfolio view for a wallet: all claimable fee positions with SOL amounts.",
      mimeType: "application/json",
    },
    async (uri, params) => {
      const wallet = String(params.wallet ?? "");
      const cacheKey = `resource:portfolio:${wallet}`;
      let data = cache.get<string>(cacheKey);

      if (!data) {
        const sdk = getBagsSDK();
        const positions = await sdk.fee.getAllClaimablePositions(new PublicKey(wallet));

        const enriched = positions.map((p) => ({
          ...p,
          claimableSol: lamportsToSol(String(p.totalClaimableLamportsUserShare)),
        }));

        const totalLamports = positions.reduce(
          (sum, p) => sum + p.totalClaimableLamportsUserShare,
          0,
        );

        const portfolio = {
          wallet,
          totalClaimableSol: lamportsToSol(String(totalLamports)),
          positionCount: enriched.length,
          positions: enriched,
        };

        data = JSON.stringify(portfolio, null, 2);
        cache.set(cacheKey, data, CACHE_TTL.volatile);
      }

      return { contents: [{ uri: uri.href, text: data }] };
    },
  );
}
