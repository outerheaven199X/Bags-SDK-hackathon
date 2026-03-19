/** bags_scout_scan — Run one scout scan cycle manually via MCP. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { mcpError } from "../../utils/errors.js";
import { runScoutCycle } from "../../agent/strategies/scout.js";
import type { ScoutSource } from "../../agent/strategies/scout-types.js";

const VALID_SOURCES = new Set<string>(["bags", "news"]);

const inputSchema = {
  sources: z
    .array(z.string())
    .optional()
    .describe('Sources to scan (default: ["bags", "news"])'),
  maxIdeas: z
    .number()
    .min(1)
    .max(10)
    .optional()
    .describe("Max ideas to generate (default: 3)"),
};

/**
 * Register the bags_scout_scan tool on the given MCP server.
 * Runs one scout cycle without the interval loop.
 * @param server - The McpServer instance to register on.
 */
export function registerScoutScan(server: McpServer) {
  server.tool(
    "bags_scout_scan",
    "Scan trending topics and assemble token launch packages. Returns ideas for review — does not launch anything.",
    inputSchema,
    async ({ sources, maxIdeas }) => {
      try {
        const validSources = (sources ?? ["bags", "news"]).filter(
          (s): s is ScoutSource => VALID_SOURCES.has(s),
        );

        const config = {
          intervalMs: 0,
          sources: validSources.length > 0 ? validSources : (["bags", "news"] as ScoutSource[]),
          maxIdeasPerCycle: maxIdeas ?? 3,
          walletAddress: process.env.AGENT_WALLET_PUBKEY,
        };

        const result = await runScoutCycle(config);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  packages: result.packages,
                  timestamp: result.timestamp,
                  sourcesScanned: result.sourcesScanned,
                  count: result.packages.length,
                  nextStep:
                    result.packages.length > 0
                      ? "Review the packages above. Use bags_scout_launch to launch one."
                      : "No ideas this cycle. Try again later or adjust sources.",
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
