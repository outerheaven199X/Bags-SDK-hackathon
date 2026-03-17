/** bags_swap — Build an unsigned swap transaction on Bags.fm. */

import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getBagsSDK } from "../../client/bags-sdk-wrapper.js";
import { mcpError } from "../../utils/errors.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";

const inputSchema = {
  tokenMint: z.string().describe("Base58 token mint address"),
  side: z.enum(["buy", "sell"]).describe("Trade direction: buy (SOL→token) or sell (token→SOL)"),
  amount: z.number().describe("Input amount in smallest unit"),
  walletAddress: z.string().describe("Trader's Base58 wallet address"),
  slippageBps: z.number().optional().describe("Slippage tolerance in BPS (default 100 = 1%)"),
};

/**
 * Register the bags_swap tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerSwap(server: McpServer) {
  server.tool(
    "bags_swap",
    "Build an unsigned swap transaction for a Bags.fm token. Returns a base64 VersionedTransaction that must be signed externally. Zero-custody: no private keys are touched.",
    inputSchema,
    async ({ tokenMint, side, amount, walletAddress, slippageBps }) => {
      try {
        const sdk = getBagsSDK();
        const inputMint = side === "buy" ? new PublicKey(SOL_MINT) : new PublicKey(tokenMint);
        const outputMint = side === "buy" ? new PublicKey(tokenMint) : new PublicKey(SOL_MINT);

        const quote = await sdk.trade.getQuote({
          inputMint,
          outputMint,
          amount,
          slippageBps: slippageBps ?? 100,
        });

        const result = await sdk.trade.createSwapTransaction({
          quoteResponse: quote,
          userPublicKey: new PublicKey(walletAddress),
        });

        const serialized = Buffer.from(result.transaction.serialize()).toString("base64");

        const output = {
          tokenMint,
          side,
          inAmount: quote.inAmount,
          outAmount: quote.outAmount,
          walletAddress,
          slippageBps: slippageBps ?? 100,
          unsignedTransaction: serialized,
          instructions: "Sign this base64 transaction with your wallet (Phantom, Solflare, Backpack) then use bags_send_transaction to broadcast.",
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
