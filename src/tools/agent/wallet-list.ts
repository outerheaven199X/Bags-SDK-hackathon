/** bags_agent_wallet_list — List wallets associated with an authenticated agent. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsPost } from "../../client/bags-rest.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  token: z.string().describe("JWT from bags_agent_auth_login"),
};

/**
 * Register the bags_agent_wallet_list tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerAgentWalletList(server: McpServer) {
  server.tool(
    "bags_agent_wallet_list",
    "List all wallets associated with the authenticated Bags.fm agent. Requires the JWT from bags_agent_auth_login.",
    inputSchema,
    async ({ token }) => {
      try {
        const result = await bagsPost<string[]>("/agent/wallet/list", { token });
        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to list agent wallets"));
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result.response, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
