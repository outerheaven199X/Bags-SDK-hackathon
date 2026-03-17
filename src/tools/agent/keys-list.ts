/** bags_agent_keys_list — List API keys for the authenticated agent. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsGet } from "../../client/bags-rest.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {};

/**
 * Register the bags_agent_keys_list tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerAgentKeysList(server: McpServer) {
  server.tool(
    "bags_agent_keys_list",
    "List all API keys associated with the authenticated Bags.fm agent. Useful for key management and rotation.",
    inputSchema,
    async () => {
      try {
        const result = await bagsGet<unknown>("/agent/keys");
        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to list agent keys"));
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result.response, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
