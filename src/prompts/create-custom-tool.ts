/** MCP Prompt: Guided workflow to scaffold a new MCP tool using the Bags SDK. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const argsSchema = {
  description: z.string().describe("Plain-English description of what the tool should do"),
};

/**
 * Register the bags_create_custom_tool prompt on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerCreateCustomToolPrompt(server: McpServer) {
  server.prompt(
    "bags_create_custom_tool",
    "Scaffold a new MCP tool from a plain-English description. Generates a complete TypeScript tool file using Bags SDK services.",
    argsSchema,
    ({ description }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `I need a new MCP tool for the Bags SDK server. Here's what it should do:

"${description}"

Write a complete TypeScript tool file following this exact pattern:

\`\`\`typescript
/** <tool_name> — <one-line description>. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Use SDK for operations that need Solana interaction:
// import { getBagsSDK } from "../../client/bags-sdk-wrapper.js";
//
// Use REST for direct API calls:
// import { bagsGet, bagsPost } from "../../client/bags-rest.js";

import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  // Zod schemas with .describe() for each parameter
};

export function registerToolName(server: McpServer) {
  server.tool(
    "bags_tool_name",
    "Clear description of what this tool does and when to use it.",
    inputSchema,
    async (params) => {
      try {
        // Implementation using SDK or REST client
        const output = { /* structured result */ };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
\`\`\`

Available SDK services (via getBagsSDK()):
  - sdk.tokenLaunch.createTokenInfoAndMetadata(params)
  - sdk.tokenLaunch.createLaunchTransaction(params)
  - sdk.config.createBagsFeeShareConfig(args)
  - sdk.fee (claiming operations)
  - sdk.trade (quotes, swaps)
  - sdk.state (pool reads)
  - sdk.partner (referral operations)
  - sdk.dexscreener (listing operations)
  - sdk.solana (send tx, balances)
  - sdk.feeShareAdmin (admin operations)

Available REST endpoints (via bagsGet/bagsPost):
  GET  /token-launch/feed
  POST /token-launch/create-token-info (multipart form)
  POST /token-launch/create-launch-transaction
  POST /fee-share/config
  GET  /fee-share/resolve-wallet?wallet=X&baseMint=Y
  GET  /fee-share/claim-stats?wallet=X
  GET  /fee-share/claim-events?wallet=X
  GET  /fee-share/admin/list?wallet=X
  POST /fee-share/admin/update
  POST /fee-share/admin/transfer
  GET  /pools
  GET  /pools/:tokenMint
  POST /partner/config
  GET  /partner/stats?wallet=X
  POST /partner/claim

Rules:
- Use Zod for all input validation with descriptive .describe() strings
- Handle all errors with mcpError()
- Return structured JSON output
- Keep the function under 50 lines
- Add a file-level JSDoc comment
- Export a single register function

Generate the complete tool file. Then tell me:
1. Where to save it (suggest a path under src/tools/)
2. How to register it in src/tools/_registry.ts
3. How to add it to the catalog in src/tools/meta/catalog.ts`,
        },
      }],
    }),
  );
}
