/** bags://launches — MCP Resource providing live token launch feed as browsable context. */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsGet } from "../client/bags-rest.js";
import { cache, CACHE_TTL } from "../client/cache.js";

const CACHE_KEY = "resource:launch-feed";

/**
 * Register the bags://launches resource on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerLaunchFeedResource(server: McpServer) {
  server.resource(
    "launch-feed",
    "bags://launches",
    {
      description: "Live feed of recent and active token launches on Bags.fm with their current status, metadata, and pool keys.",
      mimeType: "application/json",
    },
    async (uri) => {
      let data = cache.get<string>(CACHE_KEY);

      if (!data) {
        const result = await bagsGet<unknown>("/token-launch/feed");
        data = JSON.stringify(result.response, null, 2);
        cache.set(CACHE_KEY, data, CACHE_TTL.moderate);
      }

      return { contents: [{ uri: uri.href, text: data }] };
    },
  );
}
