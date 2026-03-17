/** bags_wallet_balance — Get SOL balance for a wallet via Solana RPC. */

import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getConnection } from "../../client/bags-sdk-wrapper.js";
import { mcpError } from "../../utils/errors.js";
import { lamportsToSol } from "../../utils/formatting.js";

const inputSchema = {
  walletAddress: z.string().describe("Base58 Solana wallet address"),
};

/**
 * Register the bags_wallet_balance tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerWalletBalance(server: McpServer) {
  server.tool(
    "bags_wallet_balance",
    "Get the SOL balance of a Solana wallet. Queries the RPC directly — no caching. Returns balance in both lamports and SOL.",
    inputSchema,
    async ({ walletAddress }) => {
      try {
        const connection = getConnection();
        const pubkey = new PublicKey(walletAddress);
        const balanceLamports = await connection.getBalance(pubkey);

        const output = {
          walletAddress,
          balanceLamports: String(balanceLamports),
          balanceSol: lamportsToSol(balanceLamports),
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
