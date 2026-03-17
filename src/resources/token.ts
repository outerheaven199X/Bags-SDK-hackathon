/** bags://token/{mint} — MCP Resource providing composite token detail. */

import { PublicKey } from "@solana/web3.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getBagsSDK } from "../client/bags-sdk-wrapper.js";
import { bagsGet } from "../client/bags-rest.js";
import { cache, CACHE_TTL } from "../client/cache.js";
import { lamportsToSol } from "../utils/formatting.js";

/**
 * Register the bags://token/{mint} resource template on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerTokenResource(server: McpServer) {
  server.resource(
    "token",
    new ResourceTemplate("bags://token/{mint}", { list: undefined }),
    {
      description: "Composite view of a Bags.fm token: pool info, creators, lifetime fees.",
      mimeType: "application/json",
    },
    async (uri, params) => {
      const mint = String(params.mint ?? "");
      const cacheKey = `resource:token:${mint}`;
      let data = cache.get<string>(cacheKey);

      if (!data) {
        const sdk = getBagsSDK();
        const mintKey = new PublicKey(mint);

        const [pool, creators, fees] = await Promise.allSettled([
          bagsGet<unknown>(`/pools/${mint}`),
          sdk.state.getTokenCreators(mintKey),
          sdk.state.getTokenLifetimeFees(mintKey),
        ]);

        const composite = {
          tokenMint: mint,
          pool: pool.status === "fulfilled" ? pool.value : null,
          creators: creators.status === "fulfilled" ? creators.value : null,
          lifetimeFees: fees.status === "fulfilled"
            ? { lamports: String(fees.value), sol: lamportsToSol(String(fees.value)) }
            : null,
        };

        data = JSON.stringify(composite, null, 2);
        cache.set(cacheKey, data, CACHE_TTL.moderate);
      }

      return { contents: [{ uri: uri.href, text: data }] };
    },
  );
}
