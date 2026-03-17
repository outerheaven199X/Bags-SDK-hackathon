/** bags://pools — MCP Resource providing all active pools with migration status. */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsGet } from "../client/bags-rest.js";
import { cache, CACHE_TTL } from "../client/cache.js";

const CACHE_KEY = "resource:pools";

/**
 * Register the bags://pools resource on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerPoolsResource(server: McpServer) {
  server.resource(
    "pools",
    "bags://pools",
    {
      description: "All active Bags.fm liquidity pools with token mints, pool addresses, and migration status.",
      mimeType: "application/json",
    },
    async (uri) => {
      let data = cache.get<string>(CACHE_KEY);

      if (!data) {
        const result = await bagsGet<unknown>("/pools");
        data = JSON.stringify(result.response, null, 2);
        cache.set(CACHE_KEY, data, CACHE_TTL.moderate);
      }

      return { contents: [{ uri: uri.href, text: data }] };
    },
  );
}
