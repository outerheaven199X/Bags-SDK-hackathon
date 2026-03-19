/** bags_claim_fees — Build unsigned claim transactions and open signing page. */

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
  walletAddress: z.string().describe("Base58 wallet address of the fee claimer"),
  tokenMint: z.string().describe("Base58 token mint to claim fees from"),
};

/**
 * Build the claim request body from a claimable position.
 * @param wallet - Claimer wallet address.
 * @param position - Position data from getAllClaimablePositions.
 * @returns Request body for the claim-txs/v2 endpoint.
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
 * Register the bags_claim_fees tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerClaimFees(server: McpServer) {
  server.tool(
    "bags_claim_fees",
    "Build unsigned transaction(s) to claim accumulated trading fees for a specific token. Opens a signing page for wallet signature. Fees are sent to your wallet upon confirmation.",
    inputSchema,
    async ({ walletAddress, tokenMint }) => {
      try {
        requireValidAddress(walletAddress, "walletAddress");
        requireValidAddress(tokenMint, "tokenMint");

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

        const position = matching[0] as ClaimablePosition;
        const claimParams = buildClaimParams(walletAddress, position);

        const result = await bagsPost<ClaimTxResponse[]>(CLAIM_API_PATH, claimParams);
        if (!result.success || !result.response) {
          return mcpError(new Error(result.error ?? "Failed to build claim transactions"));
        }

        const txStrings = result.response.map((item) =>
          typeof item === "string" ? item : item.tx,
        );

        startSigningServer();
        const claimableSol = lamportsToSol(String(position.totalClaimableLamportsUserShare));
        const signingUrl = await createSigningSession(
          txStrings,
          `Claim fees from ${tokenMint.slice(0, 8)}...`,
          {
            action: "Claim Fees",
            token: tokenMint.slice(0, 8) + "...",
            claimable: `${claimableSol} SOL`,
            wallet: walletAddress.slice(0, 4) + "..." + walletAddress.slice(-4),
          },
        );

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              signingUrl,
              walletAddress,
              tokenMint,
              transactionCount: txStrings.length,
              instructions: "Open the signing URL in your browser. Connect your wallet and sign to claim your fees.",
            }, null, 2),
          }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
