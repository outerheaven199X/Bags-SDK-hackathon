/** bags_agent_auth_init — Start the agent authentication flow via Moltbook. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsPost } from "../../client/bags-rest.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  agentUsername: z.string().describe("Moltbook username for the agent"),
};

/**
 * Register the bags_agent_auth_init tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerAgentAuthInit(server: McpServer) {
  server.tool(
    "bags_agent_auth_init",
    "Initialize the Bags.fm agent authentication flow with a Moltbook username. Returns a publicIdentifier, secret, and verificationPostContent to post on Moltbook before calling bags_agent_auth_login.",
    inputSchema,
    async ({ agentUsername }) => {
      try {
        const result = await bagsPost<{
          publicIdentifier: string;
          secret: string;
          agentUsername: string;
          agentUserId: string;
          verificationPostContent: string;
        }>("/agent/auth/init", { agentUsername });

        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to init agent auth"));
        }

        const resp = result.response!;
        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            publicIdentifier: resp.publicIdentifier,
            secret: resp.secret,
            agentUsername: resp.agentUsername,
            agentUserId: resp.agentUserId,
            verificationPostContent: resp.verificationPostContent,
            nextStep: "Post the verificationPostContent on Moltbook, then call bags_agent_auth_login with publicIdentifier, secret, and the postId.",
          }, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
