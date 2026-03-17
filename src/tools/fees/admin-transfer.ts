/** bags_fee_admin_transfer — Transfer fee share admin rights to another wallet. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsPost } from "../../client/bags-rest.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  baseMint: z.string().describe("Base58 token mint address"),
  currentAdmin: z.string().describe("Current admin's Base58 wallet address"),
  newAdmin: z.string().describe("New admin's Base58 wallet address"),
  payer: z.string().describe("Transaction payer's Base58 wallet address"),
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
    async ({ baseMint, currentAdmin, newAdmin, payer }) => {
      try {
        const result = await bagsPost<{ transaction: string; blockhash: unknown }>("/fee-share/admin/transfer-tx", {
          baseMint,
          currentAdmin,
          newAdmin,
          payer,
        });

        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to create admin transfer transaction"));
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            baseMint,
            from: currentAdmin,
            to: newAdmin,
            payer,
            unsignedTransaction: result.response!.transaction,
            warning: "This is irreversible. The new admin will control this fee share config.",
          }, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
