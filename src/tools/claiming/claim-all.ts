/** bags_claim_all_fees — Build unsigned claim transactions for ALL claimable positions. */

import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getBagsSDK } from "../../client/bags-sdk-wrapper.js";
import { mcpError } from "../../utils/errors.js";
import { lamportsToSol } from "../../utils/formatting.js";

const inputSchema = {
  walletAddress: z.string().describe("Base58 wallet address to claim all fees for"),
  minClaimLamports: z.string().optional().describe("Minimum claimable amount in lamports to include (skip dust)"),
};

/**
 * Register the bags_claim_all_fees composed tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerClaimAllFees(server: McpServer) {
  server.tool(
    "bags_claim_all_fees",
    "Build unsigned claim transactions for ALL claimable fee positions at once. Optionally filter out dust positions below a minimum threshold. Returns an array of transactions to sign in order.",
    inputSchema,
    async ({ walletAddress, minClaimLamports }) => {
      try {
        const sdk = getBagsSDK();
        const wallet = new PublicKey(walletAddress);
        const positions = await sdk.fee.getAllClaimablePositions(wallet);
        const minLamports = Number(minClaimLamports ?? "0");

        const claimable = positions.filter(
          (p) => p.totalClaimableLamportsUserShare > minLamports,
        );

        if (claimable.length === 0) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({
              walletAddress,
              claimablePositions: 0,
              message: "No positions above the minimum threshold to claim.",
            }, null, 2) }],
          };
        }

        const results = await Promise.allSettled(
          claimable.map(async (pos) => {
            const txs = await sdk.fee.getClaimTransaction(wallet, pos);
            const mint = "baseMint" in pos ? String(pos.baseMint) : "unknown";
            return {
              tokenMint: mint,
              claimableSol: lamportsToSol(String(pos.totalClaimableLamportsUserShare)),
              unsignedTransactions: txs.map((tx) => Buffer.from(tx.serialize()).toString("base64")),
            };
          }),
        );

        const successful = results
          .filter((r): r is PromiseFulfilledResult<{ tokenMint: string; claimableSol: string; unsignedTransactions: string[] }> =>
            r.status === "fulfilled",
          )
          .map((r) => r.value);

        const failed = results
          .filter((r): r is PromiseRejectedResult => r.status === "rejected")
          .map((r, i) => ({ index: i, error: String(r.reason) }));

        const output = {
          walletAddress,
          totalPositions: claimable.length,
          successfulClaims: successful.length,
          failedClaims: failed.length,
          transactions: successful,
          errors: failed.length > 0 ? failed : undefined,
          instructions: `Sign all transactions in order using bags_send_transaction.`,
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
