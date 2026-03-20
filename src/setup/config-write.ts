/** Safely read, merge, and write MCP config JSON files with atomic writes. */

import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";

const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";
const INDENT_SPACES = 2;

/** Result of a config write operation. */
export interface WriteResult {
  success: boolean;
  error?: string;
}

/**
 * Build the bags-sdk-mcp server config block for injection.
 * @param apiKey - The user's BAGS_API_KEY.
 * @returns The server config object ready to merge into mcpServers.
 */
export function buildServerConfig(apiKey: string): Record<string, unknown> {
  return {
    command: "npx",
    args: ["bags-sdk-mcp"],
    env: {
      BAGS_API_KEY: apiKey,
      SOLANA_RPC_URL: DEFAULT_RPC,
    },
  };
}

/**
 * Read and parse a JSON config file.
 * @param configPath - Absolute path to the JSON file.
 * @returns Parsed object, or an error message if parsing fails.
 */
function readConfig(configPath: string): Record<string, unknown> | string {
  if (!existsSync(configPath)) {
    return {};
  }
  try {
    const raw = readFileSync(configPath, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return `Failed to parse ${configPath} — the file contains invalid JSON.`;
  }
}

/**
 * Write a config object to disk using atomic rename.
 * Falls back to direct write if rename fails.
 * @param configPath - Absolute path to the target file.
 * @param data - The config object to serialize.
 */
function writeAtomic(configPath: string, data: Record<string, unknown>): void {
  const content = JSON.stringify(data, null, INDENT_SPACES) + "\n";
  const tmpName = `.bags-setup-${randomBytes(4).toString("hex")}.tmp`;
  const tmpPath = join(dirname(configPath), tmpName);

  try {
    writeFileSync(tmpPath, content, "utf8");
    renameSync(tmpPath, configPath);
  } catch {
    writeFileSync(configPath, content, "utf8");
  }
}

/**
 * Add or update the bags-sdk-mcp entry in an MCP config file.
 * Preserves all other servers in the config.
 * @param configPath - Absolute path to the config file.
 * @param apiKey - The user's BAGS_API_KEY.
 * @returns Result indicating success or failure with error message.
 */
export function installConfig(configPath: string, apiKey: string): WriteResult {
  const parsed = readConfig(configPath);
  if (typeof parsed === "string") {
    return { success: false, error: parsed };
  }

  const servers = (parsed.mcpServers ?? {}) as Record<string, unknown>;
  servers["bags-sdk-mcp"] = buildServerConfig(apiKey);
  parsed.mcpServers = servers;

  try {
    writeAtomic(configPath, parsed);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Write failed: ${msg}` };
  }
}

/**
 * Remove the bags-sdk-mcp entry from an MCP config file.
 * @param configPath - Absolute path to the config file.
 * @returns Result indicating success or failure with error message.
 */
export function uninstallConfig(configPath: string): WriteResult {
  const parsed = readConfig(configPath);
  if (typeof parsed === "string") {
    return { success: false, error: parsed };
  }

  const servers = parsed.mcpServers as Record<string, unknown> | undefined;
  if (!servers || !("bags-sdk-mcp" in servers)) {
    return { success: false, error: "bags-sdk-mcp not found in config." };
  }

  delete servers["bags-sdk-mcp"];
  parsed.mcpServers = servers;

  try {
    writeAtomic(configPath, parsed);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Write failed: ${msg}` };
  }
}

/**
 * Check whether bags-sdk-mcp is already configured in a given config file.
 * @param configPath - Absolute path to the config file.
 * @returns True if the entry exists.
 */
export function isAlreadyInstalled(configPath: string): boolean {
  const parsed = readConfig(configPath);
  if (typeof parsed === "string") return false;
  const servers = parsed.mcpServers as Record<string, unknown> | undefined;
  return !!servers && "bags-sdk-mcp" in servers;
}
