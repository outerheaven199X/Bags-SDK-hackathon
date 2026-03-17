/** bags_dexscreener_order — Create a Dexscreener boost order for a token. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsPost } from "../../client/bags-rest.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  tokenMint: z.string().describe("Base58 token mint address"),
  wallet: z.string().describe("Payer's Base58 wallet address"),
};

/**
 * Register the bags_dexscreener_order tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerDexscreenerOrder(server: McpServer) {
  server.tool(
    "bags_dexscreener_order",
    "Create a Dexscreener profile boost order for a Bags.fm token. Returns an unsigned payment transaction. Check availability first with bags_dexscreener_check.",
    inputSchema,
    async ({ tokenMint, wallet }) => {
      try {
        const result = await bagsPost<{ orderId: string; transaction: string }>("/dexscreener/order", {
          tokenMint,
          wallet,
        });

        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to create Dexscreener order"));
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            tokenMint,
            orderId: result.response!.orderId,
            unsignedTransaction: result.response!.transaction,
            nextStep: "Sign the transaction, broadcast with bags_send_transaction, then call bags_dexscreener_payment with the orderId and txSignature.",
          }, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
