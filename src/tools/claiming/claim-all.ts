/** bags_claim_all_fees — Build unsigned claim transactions for ALL positions and open signing page. */

import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getBagsSDK } from "../../client/bags-sdk-wrapper.js";
import { bagsPost } from "../../client/bags-rest.js";
import type { ClaimablePosition, DammPositionInfo } from "../../client/types.js";
import { mcpError } from "../../utils/errors.js";
import { lamportsToSol } from "../../utils/formatting.js";
import { requireValidAddress } from "../../utils/validation.js";
import { createSigningSession, startSigningServer } from "../../signing/serve.js";

const CLAIM_API_PATH = "/token-launch/claim-txs/v2";

interface ClaimTxResponse {
  tx: string;
}

const inputSchema = {
  walletAddress: z.string().describe("Base58 wallet address to claim all fees for"),
  minClaimLamports: z.string().optional().describe("Minimum claimable amount in lamports to include (skip dust)"),
};

/**
 * Build claim params from a position object.
 * @param wallet - Claimer wallet address.
 * @param position - Claimable position data.
 * @returns Request body for claim-txs/v2 endpoint.
 */
function buildClaimParams(wallet: string, position: ClaimablePosition): Record<string, unknown> {
  const params: Record<string, unknown> = {
    feeClaimer: wallet,
    tokenMint: position.baseMint,
    feeShareProgramId: position.programId,
    isCustomFeeVault: position.isCustomFeeVault ?? true,
    tokenAMint: position.baseMint,
    tokenBMint: position.quoteMint ?? "So11111111111111111111111111111111111111112",
  };

  if (position.virtualPool || position.virtualPoolAddress) {
    params.claimVirtualPoolFees = true;
    params.virtualPoolAddress = position.virtualPool ?? position.virtualPoolAddress;
  }

  if (position.isMigrated && position.dammPositionInfo) {
    const damm: DammPositionInfo = position.dammPositionInfo;
    params.claimDammV2Fees = true;
    params.dammV2Pool = damm.pool;
    params.dammV2Position = damm.position;
    params.dammV2PositionNftAccount = damm.positionNftAccount;
    params.tokenAMint = damm.tokenAMint;
    params.tokenBMint = damm.tokenBMint;
    params.tokenAVault = damm.tokenAVault;
    params.tokenBVault = damm.tokenBVault;
  }

  return params;
}

/**
 * Register the bags_claim_all_fees tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerClaimAllFees(server: McpServer) {
  server.tool(
    "bags_claim_all_fees",
    "Build unsigned claim transactions for ALL claimable fee positions at once. Opens a signing page for wallet signature. Optionally filter out dust positions below a minimum threshold.",
    inputSchema,
    async ({ walletAddress, minClaimLamports }) => {
      try {
        requireValidAddress(walletAddress, "walletAddress");

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

        const allTxStrings: string[] = [];
        const claimSummary: Array<{ tokenMint: string; claimableSol: string }> = [];
        const errors: Array<{ tokenMint: string; error: string }> = [];

        for (const pos of claimable) {
          const position = pos as ClaimablePosition;
          const mint = position.baseMint ?? "unknown";
          try {
            const claimParams = buildClaimParams(walletAddress, position);
            const result = await bagsPost<ClaimTxResponse[]>(CLAIM_API_PATH, claimParams);

            if (!result.success || !result.response) {
              errors.push({ tokenMint: mint, error: result.error ?? "API returned empty" });
              continue;
            }

            const txs = result.response.map((item) =>
              typeof item === "string" ? item : item.tx,
            );
            allTxStrings.push(...txs);
            claimSummary.push({
              tokenMint: mint,
              claimableSol: lamportsToSol(String(pos.totalClaimableLamportsUserShare)),
            });
          } catch (err) {
            errors.push({ tokenMint: mint, error: err instanceof Error ? err.message : String(err) });
          }
        }

        if (allTxStrings.length === 0) {
          return mcpError(new Error("Failed to build any claim transactions. Errors: " + JSON.stringify(errors)));
        }

        startSigningServer();
        const totalSol = claimSummary.reduce(
          (sum, c) => sum + parseFloat(c.claimableSol), 0,
        ).toFixed(4);

        const signingUrl = await createSigningSession(
          allTxStrings,
          `Claim ${totalSol} SOL in fees`,
          {
            action: "Claim All Fees",
            positions: String(claimSummary.length),
            totalClaimable: `${totalSol} SOL`,
            wallet: walletAddress.slice(0, 4) + "..." + walletAddress.slice(-4),
          },
        );

        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            signingUrl,
            walletAddress,
            totalPositions: claimable.length,
            successfulBuilds: claimSummary.length,
            failedBuilds: errors.length,
            totalClaimableSol: totalSol,
            breakdown: claimSummary,
            errors: errors.length > 0 ? errors : undefined,
            instructions: "Open the signing URL in your browser. Connect your wallet and sign all transactions to claim your fees.",
          }, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
