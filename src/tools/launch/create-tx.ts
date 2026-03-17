/** bags_create_launch_tx — Build the unsigned launch transaction for a prepared token. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsPost } from "../../client/bags-rest.js";
import { mcpError } from "../../utils/errors.js";
import { lamportsToSol } from "../../utils/formatting.js";

const inputSchema = {
  ipfs: z.string().describe("IPFS URI from bags_create_token_info (the tokenLaunch.uri field)"),
  tokenMint: z.string().describe("Base58 token mint from bags_create_token_info"),
  wallet: z.string().describe("Creator's Base58 wallet address (will be the payer)"),
  initialBuyLamports: z.number().describe("Initial buy amount in lamports (0 for no initial buy)"),
  configKey: z.string().describe("meteoraConfigKey from bags_create_fee_config"),
  tipWallet: z.string().optional().describe("Optional tip wallet address"),
  tipLamports: z.number().optional().describe("Optional tip amount in lamports"),
};

/**
 * Register the bags_create_launch_tx tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerCreateLaunchTx(server: McpServer) {
  server.tool(
    "bags_create_launch_tx",
    "Build the unsigned launch transaction for a Bags.fm token. Requires token info (from bags_create_token_info) and fee config (from bags_create_fee_config) to be created first. Returns a base64 transaction to sign externally.",
    inputSchema,
    async ({ ipfs, tokenMint, wallet, initialBuyLamports, configKey, tipWallet, tipLamports }) => {
      try {
        const body = {
          ipfs,
          tokenMint,
          wallet,
          initialBuyLamports,
          configKey,
          ...(tipWallet && { tipWallet }),
          ...(tipLamports && { tipLamports }),
        };

        const result = await bagsPost<{ transaction: string }>("/token-launch/transaction", body);
        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to create launch transaction"));
        }

        const output = {
          tokenMint,
          wallet,
          initialBuyLamports,
          initialBuySol: lamportsToSol(initialBuyLamports),
          configKey,
          unsignedTransaction: result.response!.transaction,
          instructions: "Sign this transaction with your wallet, then use bags_send_transaction to broadcast. The token will be live on Bags.fm immediately after confirmation.",
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
