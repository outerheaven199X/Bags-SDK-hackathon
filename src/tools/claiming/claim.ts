/** bags_claim_fees — Build unsigned claim transactions for a specific token's fees. */

import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getBagsSDK } from "../../client/bags-sdk-wrapper.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  walletAddress: z.string().describe("Base58 wallet address of the fee claimer"),
  tokenMint: z.string().describe("Base58 token mint to claim fees from"),
};

/**
 * Register the bags_claim_fees tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerClaimFees(server: McpServer) {
  server.tool(
    "bags_claim_fees",
    "Build unsigned transaction(s) to claim accumulated trading fees for a specific token. Returns base64 transactions to sign externally. Fees are sent to your wallet upon confirmation.",
    inputSchema,
    async ({ walletAddress, tokenMint }) => {
      try {
        const sdk = getBagsSDK();
        const wallet = new PublicKey(walletAddress);
        const positions = await sdk.fee.getAllClaimablePositions(wallet);

        const matching = positions.filter((p) => {
          const mint = "baseMint" in p ? String(p.baseMint) : "";
          return mint === tokenMint;
        });

        if (matching.length === 0) {
          return mcpError(new Error(`No claimable position found for ${tokenMint}`));
        }

        const txArrays = await Promise.all(
          matching.map((pos) => sdk.fee.getClaimTransaction(wallet, pos)),
        );

        const serialized = txArrays
          .flat()
          .map((tx) => Buffer.from(tx.serialize()).toString("base64"));

        const output = {
          walletAddress,
          tokenMint,
          transactionCount: serialized.length,
          unsignedTransactions: serialized,
          instructions: `Sign all ${serialized.length} transaction(s) in order, then use bags_send_transaction to broadcast.`,
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
