/** bags_partner_claim — Build an unsigned claim transaction for partner fees. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsPost } from "../../client/bags-rest.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  partnerWallet: z.string().describe("Base58 partner wallet address"),
};

/**
 * Register the bags_partner_claim tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerPartnerClaim(server: McpServer) {
  server.tool(
    "bags_partner_claim",
    "Build an unsigned transaction to claim accumulated partner fees. Returns a base64 transaction to sign externally.",
    inputSchema,
    async ({ partnerWallet }) => {
      try {
        const result = await bagsPost<{ transaction: string }>("/partner/claim", {
          wallet: partnerWallet,
        });

        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to create partner claim transaction"));
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            partnerWallet,
            unsignedTransaction: result.response!.transaction,
            instructions: "Sign this transaction with your partner wallet, then use bags_send_transaction.",
          }, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
