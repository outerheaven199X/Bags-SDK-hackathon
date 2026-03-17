/** bags_agent_auth_login — Complete agent authentication with a verification code. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { bagsPost } from "../../client/bags-rest.js";
import { mcpError } from "../../utils/errors.js";

const inputSchema = {
  token: z.string().describe("Auth token from bags_agent_auth_init"),
  code: z.string().optional().describe("Verification code from email/provider"),
};

/**
 * Register the bags_agent_auth_login tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerAgentAuthLogin(server: McpServer) {
  server.tool(
    "bags_agent_auth_login",
    "Complete agent authentication by submitting the verification code received from bags_agent_auth_init. Returns session credentials for agent operations.",
    inputSchema,
    async ({ token, code }) => {
      try {
        const body: Record<string, string> = { token };
        if (code) body.code = code;

        const result = await bagsPost<unknown>("/agent/auth/login", body);
        if (!result.success) {
          return mcpError(new Error(result.error ?? "Agent auth login failed"));
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
