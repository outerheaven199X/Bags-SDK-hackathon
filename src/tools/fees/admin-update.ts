/** bags_fee_admin_update — Update the claimers/BPS on an existing fee share config. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsPost } from "../../client/bags-rest.js";
import { mcpError } from "../../utils/errors.js";
import { validateBpsArray, findDuplicateWallets } from "../../composer/validator.js";

const inputSchema = {
  baseMint: z.string().describe("Base58 token mint address"),
  payer: z.string().describe("Transaction payer's Base58 wallet address (must be current admin)"),
  claimersArray: z.array(z.string()).min(1).max(100).describe("New array of Base58 claimer wallet addresses"),
  basisPointsArray: z.array(z.number()).min(1).max(100).describe("New BPS array (must sum to 10000)"),
  additionalLookupTables: z.array(z.string()).optional().describe("Optional lookup table addresses for large configs"),
};

/**
 * Register the bags_fee_admin_update tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerFeeAdminUpdate(server: McpServer) {
  server.tool(
    "bags_fee_admin_update",
    "Update the claimers and BPS allocations on an existing fee share config. Only the current admin can do this. Returns unsigned transactions.",
    inputSchema,
    async ({ baseMint, payer, claimersArray, basisPointsArray, additionalLookupTables }) => {
      try {
        const bpsValidation = validateBpsArray(basisPointsArray);
        if (!bpsValidation.valid) {
          return mcpError(new Error(`Invalid BPS: ${bpsValidation.errors.join(", ")}`));
        }

        const dupes = findDuplicateWallets(claimersArray);
        if (dupes.length > 0) {
          return mcpError(new Error(`Duplicate wallets: ${dupes.join(", ")}`));
        }

        if (claimersArray.length !== basisPointsArray.length) {
          return mcpError(new Error("Claimers and BPS arrays must be the same length."));
        }

        const body: Record<string, unknown> = {
          baseMint,
          payer,
          claimersArray,
          basisPointsArray,
        };
        if (additionalLookupTables) body.additionalLookupTables = additionalLookupTables;

        const result = await bagsPost<{ transactions: Array<{ transaction: string }> }>("/fee-share/admin/update-config", body);
        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to create admin update transaction"));
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            baseMint,
            payer,
            newClaimersCount: claimersArray.length,
            transactionCount: result.response!.transactions.length,
            unsignedTransactions: result.response!.transactions.map((t) => t.transaction),
          }, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
