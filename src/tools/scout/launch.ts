/** bags_scout_launch — Generate image, open preview page for approval, then launch. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { mcpError } from "../../utils/errors.js";
import { generateTokenImage, resolveImageConfig } from "../../agent/strategies/imagegen.js";
import { createScoutSession, WALLET_PLACEHOLDER } from "../../signing/serve.js";
import {
  TOKEN_NAME_MAX_LENGTH,
  TOKEN_SYMBOL_MAX_LENGTH,
  TOKEN_DESCRIPTION_MAX_LENGTH,
} from "../../utils/constants.js";

const feeRecipientSchema = z.object({
  provider: z.string().describe("Social provider (e.g. solana, twitter)"),
  username: z.string().describe("Username on that provider"),
  bps: z.number().min(1).max(10_000).describe("Basis points for this recipient"),
});

const feeConfigSchema = z.object({
  template: z.string().describe("Fee template used (solo, team, creator-dividends)"),
  recipients: z.array(feeRecipientSchema).describe("Fee split recipients"),
});

const packageSchema = z.object({
  name: z.string().max(TOKEN_NAME_MAX_LENGTH).describe("Token name"),
  symbol: z.string().max(TOKEN_SYMBOL_MAX_LENGTH).describe("Token ticker"),
  description: z.string().max(TOKEN_DESCRIPTION_MAX_LENGTH).describe("Token description"),
  imageUrl: z.string().url().optional().describe("Token logo URL (skip generation if provided)"),
  imagePrompt: z.string().optional().describe("Prompt for generating token logo if no imageUrl"),
  feeConfig: feeConfigSchema.describe("Fee split configuration"),
});

const inputSchema = {
  package: packageSchema.describe("Launch package from bags_scout_scan"),
  walletAddress: z.string().describe("Creator's Base58 wallet public key"),
  initialBuyLamports: z
    .number()
    .optional()
    .describe("Initial buy amount in lamports (default: 0)"),
};

/**
 * Register the bags_scout_launch tool on the given MCP server.
 * Generates the logo, opens a preview page where the user can approve/regenerate,
 * then connects wallet and signs — all in one browser tab.
 * @param server - The McpServer instance to register on.
 */
export function registerScoutLaunch(server: McpServer) {
  server.tool(
    "bags_scout_launch",
    "Launch a token from a scout package. Creates metadata, configures fees, and returns unsigned transactions for signing.",
    inputSchema,
    async ({ package: pkg, walletAddress, initialBuyLamports }) => {
      try {
        validateFeeTotal(pkg.feeConfig.recipients.map((r) => r.bps));

        const resolvedImageUrl = await resolveImage(pkg.imageUrl, pkg.imagePrompt);

        const claimers = pkg.feeConfig.recipients.map(() => WALLET_PLACEHOLDER);
        const bps = pkg.feeConfig.recipients.map((r) => r.bps);

        const previewUrl = createScoutSession({
          name: pkg.name,
          symbol: pkg.symbol.toUpperCase(),
          description: pkg.description,
          imageUrl: resolvedImageUrl,
          imagePrompt: pkg.imagePrompt ?? "",
          reasoning: "",
          source: "",
          claimersArray: claimers,
          basisPointsArray: bps,
          initialBuyLamports: initialBuyLamports ?? 0,
          meta: {
            Name: pkg.name,
            Symbol: `$${pkg.symbol.toUpperCase()}`,
            Fees: formatFeeLabel(pkg.feeConfig.template),
          },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  previewUrl,
                  message: `Preview page opened. The user will see the generated logo and can approve, regenerate, or provide feedback — then connect their wallet and sign, all in one page.`,
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
 * Resolve the final image URL: use provided URL, generate from prompt, or return empty.
 * @param imageUrl - Explicitly provided image URL.
 * @param imagePrompt - Prompt for generating an image if no URL given.
 * @returns Resolved image URL (empty string if generation failed or unavailable).
 */
async function resolveImage(
  imageUrl: string | undefined,
  imagePrompt: string | undefined,
): Promise<string> {
  if (imageUrl) return imageUrl;
  if (!imagePrompt) return "";

  const imageConfig = resolveImageConfig();
  if (!imageConfig) return "";

  const result = await generateTokenImage(imagePrompt, imageConfig);
  return result?.url ?? "";
}

/**
 * Format a fee template name into a human-readable label.
 * @param template - Template name string.
 * @returns Human-readable fee description.
 */
function formatFeeLabel(template: string): string {
  switch (template) {
    case "creator-dividends": return "70% Creator / 30% Dividends";
    case "team": return "50/50 Team Split";
    default: return "Solo (100%)";
  }
}

/**
 * Validate that fee BPS values sum to exactly 10,000.
 * @param bpsValues - Array of basis point allocations.
 * @throws Error if total does not equal 10,000.
 */
function validateFeeTotal(bpsValues: number[]): void {
  const total = bpsValues.reduce((sum, bps) => sum + bps, 0);
  if (total !== 10_000) {
    throw new Error(
      `Fee split must total 100% (10,000 BPS). Current total: ${total} BPS (${(total / 100).toFixed(1)}%).`,
    );
  }
}
