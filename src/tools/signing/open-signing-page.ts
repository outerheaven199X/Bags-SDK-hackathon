/** MCP tool: open a local signing page for wallet-based transaction signing. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { createSigningSession } from "../../signing/serve.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  transactions: z.array(z.string()).describe("Base58-encoded unsigned transactions, in signing order"),
  description: z.string().describe("What the user is signing, e.g. 'Fee config for $BGRRR'"),
  meta: z.record(z.string()).optional().describe("Token details to display (name, symbol, etc.)"),
};

/**
 * Register the bags_open_signing_page tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerOpenSigningPage(server: McpServer) {
  server.tool(
    "bags_open_signing_page",
    "Open a local signing page where the user can connect their wallet and sign transactions.",
    inputSchema,
    async ({ transactions, description, meta }) => {
      try {
        const url = await createSigningSession(transactions, description, meta || {});

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              signingUrl: url,
              transactionCount: transactions.length,
              message: `Signing page ready. Direct the user to: ${url}`,
            }),
          }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
