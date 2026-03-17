/** bags_agent_auth_init — Start the agent authentication flow. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsPost } from "../../client/bags-rest.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  email: z.string().optional().describe("Email address for email-based auth"),
  provider: z.string().optional().describe("OAuth provider name for social auth"),
};

/**
 * Register the bags_agent_auth_init tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerAgentAuthInit(server: McpServer) {
  server.tool(
    "bags_agent_auth_init",
    "Initialize the Bags.fm agent authentication flow. Provide either an email or an OAuth provider. Returns a token to use with bags_agent_auth_login after verification.",
    inputSchema,
    async ({ email, provider }) => {
      try {
        if (!email && !provider) {
          return mcpError(new Error("Either email or provider is required."));
        }

        const body: Record<string, string> = {};
        if (email) body.email = email;
        if (provider) body.provider = provider;

        const result = await bagsPost<{ token: string; message: string }>("/agent/auth/init", body);
        if (!result.success) {
          return mcpError(new Error(result.error ?? "Failed to init agent auth"));
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            token: result.response!.token,
            message: result.response!.message,
            nextStep: "Check your email/provider for a verification code, then call bags_agent_auth_login with this token and the code.",
          }, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
