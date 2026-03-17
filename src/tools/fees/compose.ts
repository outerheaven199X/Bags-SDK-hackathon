/** bags_compose_fee_config — Build and validate a fee config using the FeeConfigBuilder. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { FeeConfigBuilder } from "../../composer/fee-config.js";
import { TEMPLATE_INFO, fromTemplate, type TemplateName } from "../../composer/templates.js";
import { mcpError } from "../../utils/errors.js";
import { bpsToPercent } from "../../utils/formatting.js";
import type { SupportedProvider } from "../../client/types.js";

const inputSchema = {
  mode: z.enum(["custom", "template"]).describe("'custom' to specify recipients manually, 'template' to use a preset"),
  template: z.enum(["solo", "team", "creator-dividends", "influencer", "dao"]).optional()
    .describe("Template name (required if mode=template)"),
  creator: z.object({
    provider: z.string(),
    username: z.string(),
  }).optional().describe("Creator's provider and username (required for templates)"),
  recipients: z.array(z.object({
    provider: z.string(),
    username: z.string(),
    bps: z.number(),
  })).optional().describe("Custom recipients with BPS allocations (required if mode=custom)"),
  members: z.array(z.object({
    provider: z.string(),
    username: z.string(),
  })).optional().describe("Additional team members (for team/influencer templates)"),
};

/**
 * Register the bags_compose_fee_config builder tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerComposeFeeConfig(server: McpServer) {
  server.tool(
    "bags_compose_fee_config",
    "Build and validate a fee sharing configuration without submitting it. Use 'template' mode for presets (solo, team, creator-dividends, influencer, dao) or 'custom' mode for manual BPS allocation. Returns the validated config ready for bags_create_fee_config.",
    inputSchema,
    async ({ mode, template, creator, recipients, members }) => {
      try {
        let builder: FeeConfigBuilder;

        if (mode === "template") {
          if (!template) return mcpError(new Error("Template name required when mode=template"));
          if (!creator) return mcpError(new Error("Creator required when mode=template"));

          builder = fromTemplate(
            template as TemplateName,
            creator as { provider: SupportedProvider; username: string },
            members as Array<{ provider: SupportedProvider; username: string }>,
          );
        } else {
          if (!recipients?.length) return mcpError(new Error("Recipients required when mode=custom"));

          builder = FeeConfigBuilder.create();
          for (const r of recipients) {
            builder.addRecipient(r.provider as SupportedProvider, r.username, r.bps);
          }
        }

        const validation = builder.validate();
        const recipientList = builder.getRecipients();

        const output = {
          valid: validation.valid,
          errors: validation.errors,
          needsLookupTables: builder.needsLookupTables(),
          recipientCount: recipientList.length,
          recipients: recipientList.map((r) => ({
            provider: r.provider,
            username: r.username,
            bps: r.bps,
            percentage: bpsToPercent(r.bps),
          })),
          availableTemplates: TEMPLATE_INFO,
          nextStep: validation.valid
            ? "Resolve each recipient's wallet with bags_resolve_wallet, then call bags_create_fee_config with the wallet addresses and BPS arrays."
            : "Fix the errors above and re-run bags_compose_fee_config.",
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return mcpError(error);
      }
    },
  );
}
