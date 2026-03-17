/** bags_fee_admin_update — Update the claimers/BPS on an existing fee share config. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsPost } from "../../client/bags-rest.js";
import { mcpError } from "../../utils/errors.js";
import { validateBpsArray, findDuplicateWallets } from "../../composer/validator.js";

const inputSchema = {
  admin: z.string().describe("Admin's Base58 wallet address"),
  configKey: z.string().describe("Fee share config key to update"),
  claimersArray: z.array(z.string()).describe("New array of Base58 claimer wallet addresses"),
  basisPointsArray: z.array(z.number()).describe("New BPS array (must sum to 10000)"),
};

/**
 * Register the bags_fee_admin_update tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerFeeAdminUpdate(server: McpServer) {
  server.tool(
    "bags_fee_admin_update",
    "Update the claimers and BPS allocations on an existing fee share config. Only the current admin can do this. Returns an unsigned transaction.",
    inputSchema,
    async ({ admin, configKey, claimersArray, basisPointsArray }) => {
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

        const result = await bagsPost<{ transaction: string }>("/fee-share/admin/update", {
          admin,
          configKey,
          claimersArray,
          basisPointsArray,
        });

        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to create admin update transaction"));
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            configKey,
            admin,
            newClaimersCount: claimersArray.length,
            unsignedTransaction: result.response!.transaction,
          }, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
