/** bags_agent_auth_login — Complete agent authentication with Moltbook post verification. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsPost } from "../../client/bags-rest.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  publicIdentifier: z.string().describe("UUID from bags_agent_auth_init response"),
  secret: z.string().describe("Secret string from bags_agent_auth_init response"),
  postId: z.string().describe("Moltbook post ID of the verification post"),
};

/**
 * Register the bags_agent_auth_login tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerAgentAuthLogin(server: McpServer) {
  server.tool(
    "bags_agent_auth_login",
    "Complete agent authentication by verifying the Moltbook post. Requires the publicIdentifier and secret from bags_agent_auth_init plus the postId of the verification post. Returns a JWT valid for 365 days.",
    inputSchema,
    async ({ publicIdentifier, secret, postId }) => {
      try {
        const result = await bagsPost<{ token: string }>("/agent/auth/login", {
          publicIdentifier,
          secret,
          postId,
        });

        if (!result.success) {
          return mcpError(new Error(result.error ?? "Agent auth login failed"));
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            token: result.response!.token,
            warning: "Store this JWT securely. It is valid for 365 days.",
          }, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
