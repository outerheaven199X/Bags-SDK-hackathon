/** Preset fee config templates for common launch patterns. */

import type { SupportedProvider } from "../client/types.js";
import { FeeConfigBuilder } from "./fee-config.js";

export type TemplateName = "solo" | "team" | "creator-dividends" | "influencer" | "dao";

interface TemplateInfo {
  name: TemplateName;
  description: string;
  example: string;
}

/** Human-readable descriptions of each available template. */
export const TEMPLATE_INFO: TemplateInfo[] = [
  {
    name: "solo",
    description: "100% of fees go to the token creator.",
    example: "Solo creator launch — you keep all trading fees.",
  },
  {
    name: "creator-dividends",
    description: "Split between creator and DividendsBot for holder rewards.",
    example: "50% creator / 50% holder dividends (customizable ratio).",
  },
  {
    name: "team",
    description: "Even split across all team members.",
    example: "3 co-founders each get 33.33% of fees.",
  },
  {
    name: "influencer",
    description: "Creator + influencer affiliates + DividendsBot.",
    example: "30% creator, 50% split across influencers, 20% holder dividends.",
  },
  {
    name: "dao",
    description: "Community-first: majority to DividendsBot, minority to creator.",
    example: "20% creator / 80% holder dividends.",
  },
];

/**
 * Instantiate a FeeConfigBuilder from a named template.
 * @param template - The template name.
 * @param creator - Creator's provider and username.
 * @param members - Additional team members (for team/influencer templates).
 * @returns A pre-configured FeeConfigBuilder ready for validation.
 */
export function fromTemplate(
  template: TemplateName,
  creator: { provider: SupportedProvider; username: string },
  members?: Array<{ provider: SupportedProvider; username: string }>,
): FeeConfigBuilder {
  switch (template) {
    case "solo":
      return FeeConfigBuilder.soloCreator(creator.provider, creator.username);

    case "creator-dividends":
      return FeeConfigBuilder.creatorPlusDividends(creator.provider, creator.username);

    case "team":
      if (!members?.length) {
        throw new Error("Team template requires at least one additional member.");
      }
      return FeeConfigBuilder.teamSplit([creator, ...members]);

    case "influencer":
      if (!members?.length) {
        throw new Error("Influencer template requires at least one influencer.");
      }
      return FeeConfigBuilder.influencerLaunch(creator, members);

    case "dao":
      return FeeConfigBuilder.creatorPlusDividends(creator.provider, creator.username, 2000);
  }
}
