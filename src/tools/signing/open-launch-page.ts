/** MCP tool: open a two-phase launch page — wallet comes from the page, not from chat. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { createLaunchSession } from "../../signing/serve.js";
import { mcpError } from "../../utils/errors.js";
import { solToLamports } from "../../utils/formatting.js";

const inputSchema = {
  tokenMint: z.string().describe("Base58 token mint from bags_create_token_info"),
  uri: z.string().describe("IPFS URI from bags_create_token_info"),
  claimersArray: z.array(z.string()).describe("Resolved Base58 wallet addresses for fee claimers"),
  basisPointsArray: z.array(z.number()).describe("BPS allocations summing to 10000"),
  initialBuySol: z.number().describe("Initial buy amount in SOL (0 for none)"),
  description: z.string().describe("What the user is launching, shown on the page"),
  meta: z.record(z.string()).optional().describe("Token details to display (name, symbol, etc.)"),
};

/**
 * Register the bags_open_launch_page tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerOpenLaunchPage(server: McpServer) {
  server.tool(
    "bags_open_launch_page",
    "Open a two-phase launch page where the user connects their wallet, signs fee setup, then signs the launch — all in one page with zero friction.",
    inputSchema,
    async ({ tokenMint, uri, claimersArray, basisPointsArray, initialBuySol, description, meta }) => {
      try {
        const initialBuyLamports = solToLamports(initialBuySol);

        const url = await createLaunchSession({
          tokenMint,
          uri,
          claimersArray,
          basisPointsArray,
          initialBuyLamports,
          description,
          meta: meta || {},
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              launchUrl: url,
              message: `Launch page ready. Direct the user to: ${url}`,
            }),
          }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
