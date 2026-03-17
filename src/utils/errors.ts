/** Actionable error classes with retry hints for Bags API failures. */

const AUTH_HELP = "Check your BAGS_API_KEY env var. Get a key at dev.bags.fm";
const RATE_HELP = "Rate limited (1,000 req/hr). BagsSDK caches responses. Retry in 60 seconds.";

/**
 * Map a raw error into an actionable, human-readable message.
 * @param error - The caught error from an API call or SDK method.
 * @returns A user-facing string with a concrete next step.
 */
export function toActionableMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes("401") || msg.includes("Unauthorized")) {
    return `Authentication failed. ${AUTH_HELP}`;
  }
  if (msg.includes("429") || msg.includes("Too Many")) {
    return RATE_HELP;
  }
  if (msg.includes("404") || msg.includes("Not Found")) {
    return `Resource not found on Bags.fm. Verify addresses/mints are correct: ${msg}`;
  }
  if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
    return `Cannot reach Bags API. Check your network and BAGS_API_BASE setting: ${msg}`;
  }

  return `Bags API error: ${msg}`;
}

/**
 * Build an MCP error result payload from any caught error.
 * @param error - The caught error.
 * @returns MCP-compliant error result object with isError flag.
 */
export function mcpError(error: unknown) {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: toActionableMessage(error) }],
  };
}
