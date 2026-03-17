/** bags_fee_admin_transfer — Transfer fee share admin rights to another wallet. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsPost } from "../../client/bags-rest.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  currentAdmin: z.string().describe("Current admin's Base58 wallet address"),
  newAdmin: z.string().describe("New admin's Base58 wallet address"),
  configKey: z.string().describe("Fee share config key to transfer"),
};

/**
 * Register the bags_fee_admin_transfer tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerFeeAdminTransfer(server: McpServer) {
  server.tool(
    "bags_fee_admin_transfer",
    "Transfer fee share admin rights to a different wallet. Returns an unsigned transaction. This is irreversible — the new admin will control the fee config.",
    inputSchema,
    async ({ currentAdmin, newAdmin, configKey }) => {
      try {
        const result = await bagsPost<{ transaction: string }>("/fee-share/admin/transfer", {
          currentAdmin,
          newAdmin,
          configKey,
        });

        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to create admin transfer transaction"));
        }

        const output = {
          configKey,
          from: currentAdmin,
          to: newAdmin,
          unsignedTransaction: result.response!.transaction,
          warning: "This is irreversible. The new admin will control this fee share config.",
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
