/** Main entry: creates and configures the BagsSDK MCP server with all tools, resources, and prompts. */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerAllTools } from "./tools/_registry.js";
import { registerLaunchFeedResource } from "./resources/launch-feed.js";
import { registerPoolsResource } from "./resources/pools.js";
import { registerTokenResource } from "./resources/token.js";
import { registerPortfolioResource } from "./resources/portfolio.js";
import { registerLaunchTokenPrompt } from "./prompts/launch-token.js";
import { registerLaunchTeamTokenPrompt } from "./prompts/launch-team-token.js";
import { registerAnalyzeFeesPrompt } from "./prompts/analyze-fees.js";
import { registerSetupPartnerPrompt } from "./prompts/setup-partner.js";
import { registerClaimAllPrompt } from "./prompts/claim-all.js";
import { registerPortfolioOverviewPrompt } from "./prompts/portfolio-overview.js";
import { registerGettingStartedPrompt } from "./prompts/getting-started.js";
import { registerCreateCustomToolPrompt } from "./prompts/create-custom-tool.js";
import { SERVER_NAME, SERVER_VERSION } from "./utils/constants.js";
import { SERVER_INSTRUCTIONS } from "./server-instructions.js";

/**
 * Create a fully configured BagsSDK MCP server.
 * Registers tools, resources, and prompts with auto-loaded instructions.
 * @returns An McpServer instance ready for transport connection.
 */
export function createServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { logging: {} }, instructions: SERVER_INSTRUCTIONS },
  );

  registerAllTools(server);

  registerLaunchFeedResource(server);
  registerPoolsResource(server);
  registerTokenResource(server);
  registerPortfolioResource(server);

  registerLaunchTokenPrompt(server);
  registerLaunchTeamTokenPrompt(server);
  registerAnalyzeFeesPrompt(server);
  registerSetupPartnerPrompt(server);
  registerClaimAllPrompt(server);
  registerPortfolioOverviewPrompt(server);
  registerGettingStartedPrompt(server);
  registerCreateCustomToolPrompt(server);

  return server;
}
