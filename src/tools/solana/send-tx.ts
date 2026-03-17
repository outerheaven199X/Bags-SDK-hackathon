/** bags_send_transaction — Broadcast a signed transaction to Solana. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { VersionedTransaction } from "@solana/web3.js";

import { getConnection } from "../../client/bags-sdk-wrapper.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  signedTransaction: z.string().describe("Base64-encoded signed VersionedTransaction"),
};

/**
 * Register the bags_send_transaction tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerSendTransaction(server: McpServer) {
  server.tool(
    "bags_send_transaction",
    "Broadcast a signed Solana transaction to the network. The transaction must already be signed — BagsSDK never handles private keys. Returns the transaction signature on success.",
    inputSchema,
    async ({ signedTransaction }) => {
      try {
        const txBuffer = Buffer.from(signedTransaction, "base64");
        const tx = VersionedTransaction.deserialize(txBuffer);
        const connection = getConnection();

        const signature = await connection.sendRawTransaction(tx.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        });

        const confirmation = await connection.confirmTransaction(signature, "confirmed");
        if (confirmation.value.err) {
          return mcpError(new Error(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`));
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            signature,
            status: "confirmed",
            explorerUrl: `https://solscan.io/tx/${signature}`,
          }, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
