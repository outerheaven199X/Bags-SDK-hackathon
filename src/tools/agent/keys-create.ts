/** bags_agent_keys_create — Create a new API key for the authenticated agent. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsPost } from "../../client/bags-rest.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  token: z.string().describe("JWT from bags_agent_auth_login"),
  name: z.string().min(1).max(255).describe("Human-readable label for the key"),
};

/**
 * Register the bags_agent_keys_create tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerAgentKeysCreate(server: McpServer) {
  server.tool(
    "bags_agent_keys_create",
    "Create a new Bags.fm API key for the authenticated agent. The key is returned once — store it securely. Never share API keys.",
    inputSchema,
    async ({ token, name }) => {
      try {
        const result = await bagsPost<unknown>("/agent/dev/keys/create", { token, name });
        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to create agent key"));
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            ...result.response as object,
            warning: "This API key is shown once. Store it securely in your .env file.",
          }, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
