/** bags_dexscreener_payment — Confirm payment for a Dexscreener boost order. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsPost } from "../../client/bags-rest.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  orderId: z.string().describe("Order ID from bags_dexscreener_order"),
  txSignature: z.string().describe("Solana transaction signature of the confirmed payment"),
};

/**
 * Register the bags_dexscreener_payment tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerDexscreenerPayment(server: McpServer) {
  server.tool(
    "bags_dexscreener_payment",
    "Confirm payment for a Dexscreener boost order. Call this after the payment transaction from bags_dexscreener_order has been signed and confirmed on-chain.",
    inputSchema,
    async ({ orderId, txSignature }) => {
      try {
        const result = await bagsPost<{ status: string }>("/dexscreener/payment", {
          orderId,
          txSignature,
        });

        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to confirm Dexscreener payment"));
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            orderId,
            txSignature,
            status: result.response!.status,
          }, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
