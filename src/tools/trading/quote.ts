/** bags_quote — Get a swap price quote for a token pair on Bags.fm. */

import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getBagsSDK } from "../../client/bags-sdk-wrapper.js";
import { mcpError } from "../../utils/errors.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";

const inputSchema = {
  tokenMint: z.string().describe("Base58 token mint address to quote"),
  side: z.enum(["buy", "sell"]).describe("Trade direction: buy (SOL→token) or sell (token→SOL)"),
  amount: z.number().describe("Input amount in smallest unit (lamports for SOL, raw for token)"),
  slippageBps: z.number().optional().describe("Slippage tolerance in BPS (default 100 = 1%)"),
};

/**
 * Register the bags_quote tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerQuote(server: McpServer) {
  server.tool(
    "bags_quote",
    "Get a swap price quote for a token on Bags.fm. Returns estimated output amount for a given input. No transaction is created — this is read-only.",
    inputSchema,
    async ({ tokenMint, side, amount, slippageBps }) => {
      try {
        const sdk = getBagsSDK();
        const inputMint = side === "buy" ? new PublicKey(SOL_MINT) : new PublicKey(tokenMint);
        const outputMint = side === "buy" ? new PublicKey(tokenMint) : new PublicKey(SOL_MINT);

        const result = await sdk.trade.getQuote({
          inputMint,
          outputMint,
          amount,
          slippageBps: slippageBps ?? 100,
        });

        const output = {
          tokenMint,
          side,
          inputMint: result.inputMint,
          outputMint: result.outputMint,
          inAmount: result.inAmount,
          outAmount: result.outAmount,
          minOutAmount: result.minOutAmount,
          priceImpactPct: result.priceImpactPct,
          slippageBps: result.slippageBps,
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
