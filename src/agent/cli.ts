/** CLI entry for agent mode: parses flags and starts the appropriate strategies. */

import type { AgentConfig } from "./types.js";
import { autoClaimLoop, defaultAutoClaimConfig } from "./strategies/auto-claim.js";
import { launchMonitorLoop, defaultMonitorConfig } from "./strategies/launch-monitor.js";

/**
 * Start the agent with the configured strategies.
 * Runs strategies concurrently — each is an infinite loop.
 * @param config - Agent configuration from CLI flags.
 */
export async function startAgent(config: AgentConfig): Promise<void> {
  console.error("[agent] Starting BagsSDK autonomous agent...");

  const promises: Promise<void>[] = [];

  if (config.strategies.includes("auto-claim")) {
    console.error("[agent] Enabling auto-claim strategy");
    const claimConfig = defaultAutoClaimConfig();
    promises.push(autoClaimLoop(claimConfig));
  }

  if (config.monitor) {
    console.error("[agent] Enabling launch monitor strategy");
    const monitorConfig = defaultMonitorConfig();
    promises.push(launchMonitorLoop(monitorConfig));
  }

  if (promises.length === 0) {
    console.error("[agent] No strategies enabled. Use --auto-claim or --monitor.");
    console.error("[agent] Example: bags-sdk-mcp --agent --auto-claim --monitor");
    return;
  }

  await Promise.all(promises);
}
