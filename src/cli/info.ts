/** Print current config and capabilities without making network calls. */

import { SERVER_NAME, SERVER_VERSION, DEFAULT_API_BASE, DEFAULT_RPC_URL } from "../utils/constants.js";
import { detectClients } from "../setup/detect.js";
import { isAlreadyInstalled } from "../setup/config-write.js";

const REDACT_PREFIX_LEN = 4;
const REDACT_SUFFIX_LEN = 3;

/**
 * Print a non-diagnostic dump of current state. Instant, no network.
 */
export function printInfo(): void {
  const apiKey = process.env.BAGS_API_KEY;
  const rpcUrl = process.env.SOLANA_RPC_URL || DEFAULT_RPC_URL;
  const apiBase = process.env.BAGS_API_BASE || DEFAULT_API_BASE;
  const wallet = process.env.AGENT_WALLET_PUBKEY;

  console.log(`\n  ${SERVER_NAME} v${SERVER_VERSION}\n`);

  console.log("  Config");
  console.log(`    API base     ${apiBase}`);
  console.log(`    RPC URL      ${rpcUrl}`);
  console.log(`    API key      ${apiKey ? redactKey(apiKey) : "not set"}`);

  console.log("\n  Capabilities");
  console.log("    Tools        46");
  console.log("    Resources    4");
  console.log("    Prompts      8");

  printAgentInfo(wallet);
  printClientInfo();
}

/**
 * Print agent-mode configuration if any agent env vars are set.
 * @param wallet - AGENT_WALLET_PUBKEY value or undefined.
 */
function printAgentInfo(wallet: string | undefined): void {
  const nousKey = process.env.NOUS_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const imageProvider = process.env.IMAGE_GEN_PROVIDER || "fal";
  const falKey = process.env.FAL_API_KEY;
  const repKey = process.env.REPLICATE_API_KEY;
  const scoutSources = process.env.SCOUT_SOURCES || "bags,news";
  const scoutInterval = process.env.SCOUT_INTERVAL || "1800";
  const scoutMax = process.env.SCOUT_MAX_IDEAS || "3";

  console.log("\n  Agent");
  console.log(`    Wallet       ${wallet ? redactKey(wallet) : "not set"}`);
  console.log(`    Nous key     ${nousKey ? "set" : "not set"}`);
  console.log(`    Anthropic    ${anthropicKey ? "set" : "not set"}`);

  const imageKeySet = imageProvider === "fal" ? !!falKey : !!repKey;
  console.log(`    Image gen    ${imageProvider} (key ${imageKeySet ? "set" : "not set"})`);
  console.log(`    Scout        ${scoutSources} (${formatInterval(scoutInterval)}, ${scoutMax} max ideas)`);
}

/** Print detected MCP client status. */
function printClientInfo(): void {
  console.log("\n  Clients");
  const clients = detectClients();

  if (clients.length === 0) {
    console.log("    No MCP clients detected");
    return;
  }

  for (const client of clients) {
    const installed = isAlreadyInstalled(client.configPath);
    const icon = installed ? "\u2713" : "\u2717";
    const status = installed ? "configured" : "not configured";
    console.log(`    ${client.name.padEnd(18)} ${icon} ${status}`);
  }
}

/**
 * Redact a secret, showing first N and last M characters.
 * @param key - The secret string.
 * @returns Redacted form like "bfm_...a3x".
 */
function redactKey(key: string): string {
  if (key.length <= REDACT_PREFIX_LEN + REDACT_SUFFIX_LEN) return "***";
  return `${key.slice(0, REDACT_PREFIX_LEN)}...${key.slice(-REDACT_SUFFIX_LEN)}`;
}

/**
 * Format a seconds interval as a human-readable string.
 * @param seconds - Interval in seconds as a string.
 * @returns Formatted string like "30min".
 */
function formatInterval(seconds: string): string {
  const n = Number(seconds);
  if (n >= 3600) return `${Math.round(n / 3600)}h`;
  if (n >= 60) return `${Math.round(n / 60)}min`;
  return `${n}s`;
}
