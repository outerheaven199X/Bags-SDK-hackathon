/** Launch monitor strategy: watch new token launches and alert on matching criteria. */

import { bagsGet } from "../../client/bags-rest.js";
import { sonnetChat } from "../sonnet.js";
import type { LaunchMonitorConfig, LlmMessage } from "../types.js";

const DEFAULT_CHECK_INTERVAL_MS = 30 * 1000;

/**
 * Run the launch monitor loop: check the feed for new tokens matching criteria.
 * Escalates interesting launches to Sonnet for deeper analysis.
 * @param config - Monitor configuration with optional keyword filters.
 */
export async function launchMonitorLoop(config: LaunchMonitorConfig): Promise<void> {
  const seenMints = new Set<string>();

  console.error("[monitor] Watching launch feed...");
  if (config.keywords?.length) {
    console.error(`[monitor] Keywords: ${config.keywords.join(", ")}`);
  }

  while (true) {
    try {
      const result = await bagsGet<Array<Record<string, unknown>>>("/token-launch/feed");

      if (result.success && Array.isArray(result.response)) {
        for (const token of result.response) {
          const mint = String(token.tokenMint ?? "");
          if (!mint || seenMints.has(mint)) continue;
          seenMints.add(mint);

          const name = String(token.name ?? "");
          const description = String(token.description ?? "");
          const matchesKeyword = !config.keywords || config.keywords.some(
            (kw) =>
              name.toLowerCase().includes(kw.toLowerCase()) ||
              description.toLowerCase().includes(kw.toLowerCase()),
          );

          if (!matchesKeyword) continue;

          console.error(`[monitor] New match: ${name} (${mint})`);

          try {
            const messages: LlmMessage[] = [
              { role: "system", content: "Analyze this new Bags.fm token launch. Rate it 1-10 and explain why in 2 sentences." },
              { role: "user", content: JSON.stringify(token, null, 2) },
            ];
            const analysis = await sonnetChat(messages);
            console.error(`[monitor] Sonnet analysis: ${analysis.content}`);
          } catch (err) {
            console.error(`[monitor] Sonnet analysis failed: ${err}`);
          }
        }
      }
    } catch (err) {
      console.error(`[monitor] Feed check failed: ${err}`);
    }

    await new Promise((r) => setTimeout(r, config.checkIntervalMs));
  }
}

/**
 * Create a default launch monitor config.
 * @returns LaunchMonitorConfig with reasonable defaults.
 */
export function defaultMonitorConfig(): LaunchMonitorConfig {
  return {
    checkIntervalMs: DEFAULT_CHECK_INTERVAL_MS,
  };
}
