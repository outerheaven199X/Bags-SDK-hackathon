/** FeeConfigBuilder — fluent builder for multi-party fee split configurations. */

import type { SupportedProvider } from "../client/types.js";
import { BPS_TOTAL, MAX_FEE_CLAIMERS, LOOKUP_TABLE_THRESHOLD } from "../utils/constants.js";

interface FeeRecipient {
  provider: SupportedProvider;
  username: string;
  bps: number;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Fluent builder for composing and validating Bags fee split configurations.
 * Enforces BPS-sum-to-10000 invariant and provides preset templates.
 */
export class FeeConfigBuilder {
  private recipients: FeeRecipient[] = [];

  static create(): FeeConfigBuilder {
    return new FeeConfigBuilder();
  }

  /**
   * Add a fee recipient with a specific BPS allocation.
   * @param provider - Social platform provider.
   * @param username - Username on that platform.
   * @param bps - Basis points (1 bps = 0.01%).
   */
  addRecipient(provider: SupportedProvider, username: string, bps: number): this {
    this.recipients.push({ provider, username, bps });
    return this;
  }

  /** Alias for addRecipient — semantic sugar for the token creator. */
  addCreator(provider: SupportedProvider, username: string, bps: number): this {
    return this.addRecipient(provider, username, bps);
  }

  /** Add the DividendsBot as a fee recipient for holder dividends. */
  addDividendsBot(bps: number): this {
    return this.addRecipient("twitter", "DividendsBot", bps);
  }

  /**
   * Split the full 10000 BPS evenly across all provided recipients.
   * Remainder goes to the first recipient.
   */
  splitEvenly(recipients: Array<{ provider: SupportedProvider; username: string }>): this {
    const bpsEach = Math.floor(BPS_TOTAL / recipients.length);
    const remainder = BPS_TOTAL - bpsEach * recipients.length;
    for (let i = 0; i < recipients.length; i++) {
      const extra = i === 0 ? remainder : 0;
      this.addRecipient(recipients[i].provider, recipients[i].username, bpsEach + extra);
    }
    return this;
  }

  /** Validate the current configuration against Bags constraints. */
  validate(): ValidationResult {
    const errors: string[] = [];

    if (this.recipients.length === 0) {
      errors.push("At least one fee recipient required.");
    }
    if (this.recipients.length > MAX_FEE_CLAIMERS) {
      errors.push(`Maximum ${MAX_FEE_CLAIMERS} fee claimers per token.`);
    }

    const totalBps = this.recipients.reduce((sum, r) => sum + r.bps, 0);
    if (totalBps !== BPS_TOTAL) {
      errors.push(
        `BPS must sum to exactly ${BPS_TOTAL} (100%). Current total: ${totalBps} (${totalBps / 100}%).`,
      );
    }

    for (let i = 0; i < this.recipients.length; i++) {
      const r = this.recipients[i];
      if (r.bps <= 0) errors.push(`Recipient ${i} (${r.username}): BPS must be positive.`);
      if (r.bps > BPS_TOTAL) errors.push(`Recipient ${i} (${r.username}): BPS cannot exceed ${BPS_TOTAL}.`);
    }

    const seen = new Set<string>();
    for (const r of this.recipients) {
      const key = `${r.provider}:${r.username}`;
      if (seen.has(key)) errors.push(`Duplicate recipient: ${r.provider}/${r.username}`);
      seen.add(key);
    }

    return { valid: errors.length === 0, errors };
  }

  /** Return a defensive copy of the recipients list. */
  getRecipients(): FeeRecipient[] {
    return [...this.recipients];
  }

  /** Whether this config needs additional lookup tables (>15 claimers). */
  needsLookupTables(): boolean {
    return this.recipients.length > LOOKUP_TABLE_THRESHOLD;
  }

  /** Solo creator gets 100% of fees. */
  static soloCreator(provider: SupportedProvider, username: string): FeeConfigBuilder {
    return FeeConfigBuilder.create().addRecipient(provider, username, BPS_TOTAL);
  }

  /** Creator + DividendsBot split. Default 50/50. */
  static creatorPlusDividends(
    provider: SupportedProvider,
    username: string,
    creatorBps: number = 5000,
  ): FeeConfigBuilder {
    return FeeConfigBuilder.create()
      .addRecipient(provider, username, creatorBps)
      .addDividendsBot(BPS_TOTAL - creatorBps);
  }

  /** Even split across all team members. */
  static teamSplit(
    members: Array<{ provider: SupportedProvider; username: string }>,
  ): FeeConfigBuilder {
    return FeeConfigBuilder.create().splitEvenly(members);
  }

  /** Creator + influencers + DividendsBot. Custom BPS allocation. */
  static influencerLaunch(
    creator: { provider: SupportedProvider; username: string },
    influencers: Array<{ provider: SupportedProvider; username: string }>,
    options: { creatorBps?: number; dividendsBps?: number } = {},
  ): FeeConfigBuilder {
    const creatorBps = options.creatorBps ?? 3000;
    const dividendsBps = options.dividendsBps ?? 2000;
    const influencerBpsTotal = BPS_TOTAL - creatorBps - dividendsBps;
    const perInfluencer = Math.floor(influencerBpsTotal / influencers.length);
    const remainder = influencerBpsTotal - perInfluencer * influencers.length;

    const builder = FeeConfigBuilder.create().addRecipient(
      creator.provider,
      creator.username,
      creatorBps,
    );

    for (let i = 0; i < influencers.length; i++) {
      const extra = i === 0 ? remainder : 0;
      builder.addRecipient(influencers[i].provider, influencers[i].username, perInfluencer + extra);
    }

    builder.addDividendsBot(dividendsBps);
    return builder;
  }
}
