/** bags_launch_token — Composed workflow: create info + fee config + launch tx in one call. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsPost } from "../../client/bags-rest.js";
import { mcpError } from "../../utils/errors.js";
import { lamportsToSol } from "../../utils/formatting.js";
import type { CreateTokenInfoResponse, CreateFeeShareConfigResponse } from "../../client/types.js";

const inputSchema = {
  name: z.string().describe("Token name (max 32 chars)"),
  symbol: z.string().describe("Token symbol (max 10 chars)"),
  description: z.string().describe("Token description (max 1000 chars)"),
  imageUrl: z.string().url().describe("Public URL for the token image"),
  wallet: z.string().describe("Creator's Base58 wallet address"),
  claimersArray: z.array(z.string()).describe("Array of Base58 wallet addresses for fee claimers"),
  basisPointsArray: z.array(z.number()).describe("Array of BPS values (must sum to 10000)"),
  initialBuyLamports: z.number().optional().describe("Initial buy amount in lamports (default 0)"),
  telegram: z.string().optional().describe("Telegram group URL"),
  twitter: z.string().optional().describe("Twitter/X profile URL"),
  website: z.string().optional().describe("Project website URL"),
};

/**
 * Register the bags_launch_token composed tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerLaunchTokenFull(server: McpServer) {
  server.tool(
    "bags_launch_token",
    "Full token launch workflow in one call: creates token metadata, sets up fee sharing config, and builds the launch transaction. Returns all unsigned transactions to sign in order. This is the easiest way to launch a token on Bags.fm.",
    inputSchema,
    async (params) => {
      try {
        const { name, symbol, description, imageUrl, wallet, claimersArray, basisPointsArray } = params;
        const initialBuyLamports = params.initialBuyLamports ?? 0;

        const infoResult = await bagsPost<CreateTokenInfoResponse>("/token-launch/create", {
          name,
          symbol: symbol.toUpperCase(),
          description,
          imageUrl,
          telegram: params.telegram ?? null,
          twitter: params.twitter ?? null,
          website: params.website ?? null,
        });
        if (!infoResult.success) {
          return mcpError(new Error(`Token info creation failed: ${infoResult.error}`));
        }

        const tokenMint = infoResult.response!.tokenMint;
        const uri = infoResult.response!.tokenLaunch.uri;

        const configResult = await bagsPost<CreateFeeShareConfigResponse>("/fee-share/create-config", {
          payer: wallet,
          baseMint: tokenMint,
          claimersArray,
          basisPointsArray,
        });
        if (!configResult.success) {
          return mcpError(new Error(`Fee config creation failed: ${configResult.error}`));
        }

        const configKey = configResult.response!.meteoraConfigKey;
        const feeConfigTxs = configResult.response!.transactions;

        const launchResult = await bagsPost<{ transaction: string }>("/token-launch/transaction", {
          ipfs: uri,
          tokenMint,
          wallet,
          initialBuyLamports,
          configKey,
        });
        if (!launchResult.success) {
          return mcpError(new Error(`Launch transaction failed: ${launchResult.error}`));
        }

        const output = {
          tokenMint,
          symbol: symbol.toUpperCase(),
          name,
          configKey,
          initialBuySol: lamportsToSol(initialBuyLamports),
          feeConfigTransactions: feeConfigTxs.map((t) => t.transaction),
          launchTransaction: launchResult.response!.transaction,
          totalTransactionsToSign: feeConfigTxs.length + 1,
          instructions: `Sign all ${feeConfigTxs.length + 1} transactions in order: fee config txs first, then the launch tx. Use bags_send_transaction for each.`,
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
