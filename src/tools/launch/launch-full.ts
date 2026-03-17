/** bags_launch_token — Composed workflow: create info + fee config in one call (step 1 of launch). */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsPost } from "../../client/bags-rest.js";
import { getBagsSDK } from "../../client/bags-sdk-wrapper.js";
import { mcpError } from "../../utils/errors.js";
import { lamportsToSol } from "../../utils/formatting.js";
import type { CreateFeeShareConfigResponse } from "../../client/types.js";

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
    "Token launch setup: creates token metadata on IPFS and fee sharing config. Returns unsigned fee config transactions to sign. After signing, call bags_create_launch_tx to build the final launch transaction.",
    inputSchema,
    async (params) => {
      try {
        const { name, symbol, description, imageUrl, wallet, claimersArray, basisPointsArray } = params;
        const initialBuyLamports = params.initialBuyLamports ?? 0;

        const sdk = getBagsSDK();
        const infoResult = await sdk.tokenLaunch.createTokenInfoAndMetadata({
          name,
          symbol: symbol.toUpperCase(),
          description,
          imageUrl,
          telegram: params.telegram ?? undefined,
          twitter: params.twitter ?? undefined,
          website: params.website ?? undefined,
        });

        const tokenMint = infoResult.tokenMint;
        const uri = infoResult.tokenLaunch.uri || infoResult.tokenMetadata;

        const configResult = await bagsPost<CreateFeeShareConfigResponse>("/fee-share/config", {
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

        const output = {
          tokenMint,
          uri,
          symbol: symbol.toUpperCase(),
          name,
          configKey,
          wallet,
          initialBuyLamports,
          initialBuySol: lamportsToSol(initialBuyLamports),
          feeConfigTransactions: feeConfigTxs.map((t) => t.transaction),
          transactionsToSign: feeConfigTxs.length,
          nextStep: `Sign the ${feeConfigTxs.length} fee config transaction(s), then call bags_create_launch_tx with tokenMint="${tokenMint}", uri="${uri}", configKey="${configKey}", wallet="${wallet}", and initialBuyLamports=${initialBuyLamports}.`,
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
