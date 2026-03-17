/** bags_create_fee_config — Create an on-chain fee sharing configuration. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsPost } from "../../client/bags-rest.js";
import { mcpError } from "../../utils/errors.js";
import { validateBpsArray, needsLookupTables, findDuplicateWallets } from "../../composer/validator.js";
import type { CreateFeeShareConfigResponse } from "../../client/types.js";

const inputSchema = {
  payer: z.string().describe("Base58 wallet of the transaction payer"),
  baseMint: z.string().describe("Base58 token mint address"),
  claimersArray: z.array(z.string()).describe("Array of Base58 wallet addresses for fee claimers (1-100)"),
  basisPointsArray: z.array(z.number()).describe("Array of BPS values, must sum to exactly 10000"),
  partner: z.string().optional().describe("Optional partner wallet address"),
  partnerConfig: z.string().optional().describe("Optional partner config address"),
  tipWallet: z.string().optional().describe("Optional tip wallet address"),
  tipLamports: z.number().optional().describe("Optional tip amount in lamports"),
};

/**
 * Register the bags_create_fee_config tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerCreateFeeConfig(server: McpServer) {
  server.tool(
    "bags_create_fee_config",
    "Create an on-chain fee sharing configuration for a Bags.fm token. BPS must sum to exactly 10000 (100%). Returns unsigned transactions and the meteoraConfigKey needed for the launch transaction.",
    inputSchema,
    async ({ payer, baseMint, claimersArray, basisPointsArray, partner, partnerConfig, tipWallet, tipLamports }) => {
      try {
        const bpsValidation = validateBpsArray(basisPointsArray);
        if (!bpsValidation.valid) {
          return mcpError(new Error(`Invalid BPS config: ${bpsValidation.errors.join(", ")}`));
        }

        const dupes = findDuplicateWallets(claimersArray);
        if (dupes.length > 0) {
          return mcpError(new Error(`Duplicate wallet addresses: ${dupes.join(", ")}`));
        }

        if (claimersArray.length !== basisPointsArray.length) {
          return mcpError(new Error(`Claimers array (${claimersArray.length}) and BPS array (${basisPointsArray.length}) must be the same length.`));
        }

        const body: Record<string, unknown> = {
          payer,
          baseMint,
          claimersArray,
          basisPointsArray,
        };
        if (partner) body.partner = partner;
        if (partnerConfig) body.partnerConfig = partnerConfig;
        if (needsLookupTables(claimersArray.length)) {
          body.additionalLookupTables = [];
        }
        if (tipWallet) body.tipWallet = tipWallet;
        if (tipLamports) body.tipLamports = tipLamports;

        const result = await bagsPost<CreateFeeShareConfigResponse>("/fee-share/create-config", body);
        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to create fee config"));
        }

        const resp = result.response!;
        const output = {
          meteoraConfigKey: resp.meteoraConfigKey,
          feeShareAuthority: resp.feeShareAuthority,
          needsCreation: resp.needsCreation,
          transactionCount: resp.transactions.length,
          unsignedTransactions: resp.transactions.map((t) => t.transaction),
          instructions: `Sign all ${resp.transactions.length} fee config transaction(s) in order before the launch transaction.`,
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
