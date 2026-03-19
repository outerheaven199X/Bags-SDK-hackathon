/** bags_generate_token_image — Standalone image generation tool via MCP. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { mcpError } from "../../utils/errors.js";
import { generateTokenImage, resolveImageConfig } from "../../agent/strategies/imagegen.js";

const inputSchema = {
  prompt: z.string().min(1).describe("Image generation prompt describing the token logo"),
  provider: z
    .enum(["fal", "replicate"])
    .optional()
    .describe('Image provider to use (default: from IMAGE_GEN_PROVIDER env)'),
};

/**
 * Register the bags_generate_token_image tool on the given MCP server.
 * Generates a token logo image from a text prompt.
 * @param server - The McpServer instance to register on.
 */
export function registerGenerateTokenImage(server: McpServer) {
  server.tool(
    "bags_generate_token_image",
    "Generate a token logo image from a text prompt using fal.ai or Replicate. Returns an image URL ready for token launches. Use this to regenerate a logo if the user rejects the first one — pass their feedback as part of the prompt.",
    inputSchema,
    async ({ prompt, provider }) => {
      try {
        const config = resolveProviderConfig(provider);

        if (!config) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    error: "No image generation API key configured.",
                    help: "Set FAL_API_KEY or REPLICATE_API_KEY in your environment.",
                    imageUrl: null,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        const result = await generateTokenImage(prompt, config);

        if (!result) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    error: "Image generation failed. Check API key and try again.",
                    prompt,
                    provider: config.provider,
                    imageUrl: null,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  imageUrl: result.url,
                  provider: result.provider,
                  prompt,
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

/**
 * Resolve provider config, allowing an explicit override.
 * @param providerOverride - Optional explicit provider choice.
 * @returns Image generation config or null if no keys available.
 */
function resolveProviderConfig(
  providerOverride?: "fal" | "replicate",
): { provider: "fal" | "replicate"; apiKey: string } | null {
  if (providerOverride === "fal" && process.env.FAL_API_KEY) {
    return { provider: "fal", apiKey: process.env.FAL_API_KEY };
  }
  if (providerOverride === "replicate" && process.env.REPLICATE_API_KEY) {
    return { provider: "replicate", apiKey: process.env.REPLICATE_API_KEY };
  }

  return resolveImageConfig();
}
