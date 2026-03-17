/** bags_token_holdings — Get SPL token holdings for a wallet via Solana RPC. */

import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getConnection } from "../../client/bags-sdk-wrapper.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  walletAddress: z.string().describe("Base58 Solana wallet address"),
};

interface TokenHolding {
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: number | null;
}

/**
 * Register the bags_token_holdings tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerTokenHoldings(server: McpServer) {
  server.tool(
    "bags_token_holdings",
    "Get all SPL token holdings for a Solana wallet. Queries RPC directly for token accounts. Returns mint addresses, raw amounts, and human-readable amounts.",
    inputSchema,
    async ({ walletAddress }) => {
      try {
        const connection = getConnection();
        const pubkey = new PublicKey(walletAddress);

        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
          programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        });

        const holdings: TokenHolding[] = tokenAccounts.value.map((account) => {
          const parsed = account.account.data.parsed.info;
          return {
            mint: parsed.mint,
            amount: parsed.tokenAmount.amount,
            decimals: parsed.tokenAmount.decimals,
            uiAmount: parsed.tokenAmount.uiAmount,
          };
        });

        const nonZero = holdings.filter((h) => h.amount !== "0");

        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            walletAddress,
            totalTokenAccounts: holdings.length,
            nonZeroHoldings: nonZero.length,
            holdings: nonZero,
          }, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
