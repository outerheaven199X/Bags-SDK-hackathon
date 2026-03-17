/** bags_pool_config_keys — Get the Meteora config keys for a pool. */

import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getBagsSDK } from "../../client/bags-sdk-wrapper.js";
import { cache, CACHE_TTL } from "../../client/cache.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  feeClaimerVaults: z.array(z.string()).describe("Array of Base58 fee claimer vault addresses"),
};

/**
 * Register the bags_pool_config_keys tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerPoolConfigKeys(server: McpServer) {
  server.tool(
    "bags_pool_config_keys",
    "Get the Meteora pool configuration keys by fee claimer vault addresses. Returns config keys for advanced fee config operations.",
    inputSchema,
    async ({ feeClaimerVaults }) => {
      try {
        const cacheKey = `pool-config:${feeClaimerVaults.join(",")}`;
        const cached = cache.get<unknown>(cacheKey);
        if (cached) {
          return { content: [{ type: "text" as const, text: JSON.stringify(cached, null, 2) }] };
        }

        const sdk = getBagsSDK();
        const vaultKeys = feeClaimerVaults.map((v) => new PublicKey(v));
        const configKeys = await sdk.state.getPoolConfigKeysByFeeClaimerVaults(vaultKeys);

        const result = configKeys.map((k) => k.toBase58());
        cache.set(cacheKey, result, CACHE_TTL.stable);

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
