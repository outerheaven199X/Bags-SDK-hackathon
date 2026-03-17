/** bags_agent_keys_create — Create a new API key for the authenticated agent. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsPost } from "../../client/bags-rest.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  name: z.string().optional().describe("Optional human-readable label for the key"),
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
    async ({ name }) => {
      try {
        const body: Record<string, string> = {};
        if (name) body.name = name;

        const result = await bagsPost<{ apiKey: string; name: string }>("/agent/keys", body);
        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to create agent key"));
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            ...result.response,
            warning: "This API key is shown once. Store it securely in your .env file.",
          }, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
