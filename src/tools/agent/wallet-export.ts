/** bags_agent_wallet_export — Export an agent wallet's public key details. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsGet } from "../../client/bags-rest.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  walletId: z.string().describe("Wallet ID from bags_agent_wallet_list"),
};

/**
 * Register the bags_agent_wallet_export tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerAgentWalletExport(server: McpServer) {
  server.tool(
    "bags_agent_wallet_export",
    "Export the public key details for an agent wallet. This is read-only — no private keys are ever exposed. Use the wallet ID from bags_agent_wallet_list.",
    inputSchema,
    async ({ walletId }) => {
      try {
        const result = await bagsGet<unknown>(`/agent/wallets/${walletId}/export`);
        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to export agent wallet"));
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
