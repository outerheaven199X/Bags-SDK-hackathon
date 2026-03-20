/** Detect installed MCP clients by checking known config file paths. */

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir, platform } from "node:os";

/** Supported MCP client identifiers. */
export type ClientId = "claude-desktop" | "cursor" | "claude-code";

/** A detected MCP client and its config file path. */
export interface DetectedClient {
  id: ClientId;
  name: string;
  configPath: string;
}

interface ClientCandidate {
  id: ClientId;
  name: string;
  paths: () => string[];
}

const APPDATA = process.env.APPDATA ?? "";

/**
 * Build the list of candidate config paths for each known MCP client.
 * @returns Array of client candidates with lazy-evaluated path lists.
 */
function buildCandidates(): ClientCandidate[] {
  const home = homedir();
  const os = platform();

  return [
    {
      id: "claude-desktop" as const,
      name: "Claude Desktop",
      paths: () => {
        if (os === "darwin") {
          return [join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json")];
        }
        if (os === "win32" && APPDATA) {
          return [join(APPDATA, "Claude", "claude_desktop_config.json")];
        }
        if (os === "linux") {
          return [join(home, ".config", "Claude", "claude_desktop_config.json")];
        }
        return [];
      },
    },
    {
      id: "cursor" as const,
      name: "Cursor",
      paths: () => walkUp(".cursor", "mcp.json", home),
    },
    {
      id: "claude-code" as const,
      name: "Claude Code",
      paths: () => walkUp("", ".mcp.json", home),
    },
  ];
}

/**
 * Walk up from cwd to home looking for a config file.
 * @param subdir - Subdirectory to check inside each ancestor (empty string for root-level files).
 * @param filename - Config filename to look for.
 * @param stopAt - Stop walking when we reach this directory.
 * @returns Array of matching absolute paths (usually 0 or 1).
 */
function walkUp(subdir: string, filename: string, stopAt: string): string[] {
  const results: string[] = [];
  let dir = resolve(process.cwd());
  const stop = resolve(stopAt);

  while (true) {
    const candidate = subdir
      ? join(dir, subdir, filename)
      : join(dir, filename);
    if (existsSync(candidate)) {
      results.push(candidate);
      break;
    }
    const parent = resolve(dir, "..");
    if (dir === parent || dir === stop) break;
    dir = parent;
  }

  // Also check home directory if we didn't already
  const homeCandidate = subdir
    ? join(stop, subdir, filename)
    : join(stop, filename);
  if (results.length === 0 && existsSync(homeCandidate)) {
    results.push(homeCandidate);
  }

  return results;
}

/**
 * Scan the filesystem for installed MCP clients.
 * @returns Array of detected clients with their config file paths.
 */
export function detectClients(): DetectedClient[] {
  const candidates = buildCandidates();
  const detected: DetectedClient[] = [];

  for (const candidate of candidates) {
    for (const configPath of candidate.paths()) {
      if (existsSync(configPath)) {
        detected.push({ id: candidate.id, name: candidate.name, configPath });
        break;
      }
    }
  }

  return detected;
}

/**
 * Get the default config path for a client even if the file doesn't exist yet.
 * Used when the directory exists but the config file hasn't been created.
 * @param clientId - The client to get the default path for.
 * @returns The default config path, or null if the client directory doesn't exist.
 */
export function getDefaultConfigPath(clientId: ClientId): string | null {
  const home = homedir();
  const os = platform();

  const pathMap: Record<ClientId, () => string | null> = {
    "claude-desktop": () => {
      if (os === "darwin") {
        const dir = join(home, "Library", "Application Support", "Claude");
        return existsSync(dir) ? join(dir, "claude_desktop_config.json") : null;
      }
      if (os === "win32" && APPDATA) {
        const dir = join(APPDATA, "Claude");
        return existsSync(dir) ? join(dir, "claude_desktop_config.json") : null;
      }
      if (os === "linux") {
        const dir = join(home, ".config", "Claude");
        return existsSync(dir) ? join(dir, "claude_desktop_config.json") : null;
      }
      return null;
    },
    cursor: () => {
      const dir = join(process.cwd(), ".cursor");
      return existsSync(dir) ? join(dir, "mcp.json") : null;
    },
    "claude-code": () => join(process.cwd(), ".mcp.json"),
  };

  return pathMap[clientId]();
}
