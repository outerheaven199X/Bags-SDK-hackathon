/** bags_agent_bootstrap — Composed workflow: auth init → login → list wallets → create key. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { mcpError } from "../../utils/errors.js";

const inputSchema = {};

/**
 * Register the bags_agent_bootstrap composed tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerAgentBootstrap(server: McpServer) {
  server.tool(
    "bags_agent_bootstrap",
    "Guided agent lifecycle setup. This prompt walks you through the full agent setup: authentication, wallet discovery, and API key creation. Start here if you're setting up a new Bags.fm agent.",
    inputSchema,
    async () => {
      try {
        const output = {
          workflow: "Agent Bootstrap",
          steps: [
            { step: 1, tool: "bags_agent_auth_init", description: "Start auth with your Moltbook username" },
            { step: 2, action: "Post the verificationPostContent on Moltbook" },
            { step: 3, tool: "bags_agent_auth_login", description: "Complete auth with publicIdentifier, secret, and postId" },
            { step: 4, tool: "bags_agent_wallet_list", description: "List your agent wallets (pass JWT token)" },
            { step: 5, tool: "bags_agent_keys_create", description: "Create an API key (pass JWT token and key name)" },
            { step: 6, action: "Add the API key to your .env as BAGS_API_KEY" },
          ],
          instructions: "Follow these steps in order. Each tool call builds on the previous one. Call bags_agent_auth_init with your Moltbook username to begin.",
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
