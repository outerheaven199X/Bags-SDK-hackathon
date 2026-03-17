/** bags_agent_wallet_export — Export an agent wallet's private key. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsPost } from "../../client/bags-rest.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  token: z.string().describe("JWT from bags_agent_auth_login"),
  walletAddress: z.string().describe("Base58 Solana public key from bags_agent_wallet_list"),
};

/**
 * Register the bags_agent_wallet_export tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerAgentWalletExport(server: McpServer) {
  server.tool(
    "bags_agent_wallet_export",
    "Export the private key for an agent wallet. Handle with extreme care — never share or log the returned key.",
    inputSchema,
    async ({ token, walletAddress }) => {
      try {
        const result = await bagsPost<{ privateKey: string }>("/agent/wallet/export", {
          token,
          walletAddress,
        });

        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to export agent wallet"));
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            walletAddress,
            privateKey: result.response!.privateKey,
            warning: "This is a private key. Store it securely and never share it.",
          }, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
