/** Diagnostic suite — checks env, connectivity, API key, configs, sessions. */

import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { SERVER_NAME, SERVER_VERSION, DEFAULT_API_BASE, DEFAULT_RPC_URL } from "../utils/constants.js";
import { detectClients } from "../setup/detect.js";
import { isAlreadyInstalled } from "../setup/config-write.js";

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const SESSIONS_PATH = resolve(THIS_DIR, "../../.sessions/sessions.json");
const SIGNING_PORT = 3141;
const FETCH_TIMEOUT_MS = 5_000;
const SESSION_TTL_MS = 600_000;
const REDACT_PREFIX = 4;
const REDACT_SUFFIX = 3;

/** Result of a single diagnostic check. */
interface CheckResult {
  label: string;
  status: "ok" | "warn" | "fail";
  detail: string;
}

/**
 * Run all diagnostic checks and print results.
 * @returns Exit code: 0 if no issues, 1 if any check failed.
 */
export async function runDoctor(): Promise<number> {
  console.log(`\n  ${SERVER_NAME} doctor`);
  console.log("  " + "\u2500".repeat(SERVER_NAME.length + 7));

  const results: CheckResult[] = [];

  results.push(...checkEnvVars());
  results.push(...(await checkConnectivity()));
  results.push(...checkClientConfigs());
  results.push(...checkServerMeta());
  results.push(...checkSessions());

  printResults(results);
  return printSummary(results);
}

/** Check all known environment variables. */
function checkEnvVars(): CheckResult[] {
  const results: CheckResult[] = [];

  console.log("\n  Environment");
  const checks: Array<{ key: string; required: boolean; note: string }> = [
    { key: "BAGS_API_KEY", required: true, note: "" },
    { key: "SOLANA_RPC_URL", required: false, note: `default: ${DEFAULT_RPC_URL}` },
    { key: "NOUS_API_KEY", required: false, note: "needed for agent mode" },
    { key: "ANTHROPIC_API_KEY", required: false, note: "needed for agent mode" },
    { key: "AGENT_WALLET_PUBKEY", required: false, note: "needed for agent mode" },
    { key: "IMAGE_GEN_PROVIDER", required: false, note: "needed for scout image generation" },
    { key: "FAL_API_KEY", required: false, note: "needed for scout (fal)" },
    { key: "REPLICATE_API_KEY", required: false, note: "needed for scout (replicate)" },
  ];

  for (const { key, required, note } of checks) {
    const val = process.env[key];
    const icon = val ? "\u2713" : "\u2717";
    const detail = val ? `set (${redact(val)})` : `not set${note ? ` (${note})` : ""}`;
    const status = val ? "ok" : required ? "fail" : "warn";

    console.log(`    ${key.padEnd(22)} ${icon} ${detail}`);
    results.push({ label: key, status, detail });
  }

  return results;
}

/** Check Bags API, Solana RPC, and signing port connectivity. */
async function checkConnectivity(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  console.log("\n  Connectivity");

  const apiResult = await checkBagsApi();
  console.log(`    Bags API              ${apiResult.status === "ok" ? "\u2713" : "\u2717"} ${apiResult.detail}`);
  results.push(apiResult);

  const rpcResult = await checkSolanaRpc();
  console.log(`    Solana RPC            ${rpcResult.status === "ok" ? "\u2713" : "\u2717"} ${rpcResult.detail}`);
  results.push(rpcResult);

  const portResult = await checkPort();
  console.log(`    Signing server port   ${portResult.status === "ok" ? "\u2713" : "\u2717"} ${portResult.detail}`);
  results.push(portResult);

  return results;
}

/** Test the Bags API with a lightweight feed call. */
async function checkBagsApi(): Promise<CheckResult> {
  const apiKey = process.env.BAGS_API_KEY;
  if (!apiKey) return { label: "Bags API", status: "fail", detail: "skipped (no API key)" };

  const base = process.env.BAGS_API_BASE || DEFAULT_API_BASE;
  const url = `${base}/token-launch/feed?limit=1`;
  const start = Date.now();

  try {
    const res = await fetchWithTimeout(url, { headers: { "x-api-key": apiKey } });
    const ms = Date.now() - start;

    if (res.status === 401) {
      return { label: "Bags API", status: "fail", detail: `invalid API key (401, ${ms}ms)` };
    }
    if (!res.ok) {
      return { label: "Bags API", status: "fail", detail: `HTTP ${res.status} (${ms}ms)` };
    }
    return { label: "Bags API", status: "ok", detail: `reachable (${ms}ms)` };
  } catch (err) {
    return { label: "Bags API", status: "fail", detail: formatNetworkError(err) };
  }
}

/** Test Solana RPC with a getBlockHeight call. */
async function checkSolanaRpc(): Promise<CheckResult> {
  const rpcUrl = process.env.SOLANA_RPC_URL || DEFAULT_RPC_URL;
  const start = Date.now();

  try {
    const res = await fetchWithTimeout(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBlockHeight" }),
    });
    const ms = Date.now() - start;

    if (!res.ok) {
      return { label: "Solana RPC", status: "fail", detail: `HTTP ${res.status} (${ms}ms)` };
    }

    const json = await res.json() as { result?: number };
    const height = json.result;
    return { label: "Solana RPC", status: "ok", detail: `reachable (${ms}ms, block height: ${height})` };
  } catch (err) {
    return { label: "Solana RPC", status: "fail", detail: formatNetworkError(err) };
  }
}

/** Check if the signing server port is available. */
function checkPort(): Promise<CheckResult> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => {
      resolve({ label: "Signing port", status: "warn", detail: `${SIGNING_PORT} in use` });
    });
    server.listen(SIGNING_PORT, "127.0.0.1", () => {
      server.close(() => {
        resolve({ label: "Signing port", status: "ok", detail: `${SIGNING_PORT} available` });
      });
    });
  });
}

/** Check which MCP clients have bags-sdk-mcp configured. */
function checkClientConfigs(): CheckResult[] {
  const results: CheckResult[] = [];
  console.log("\n  MCP Client Configs");

  const clients = detectClients();
  const checked = new Set<string>();

  for (const client of clients) {
    const installed = isAlreadyInstalled(client.configPath);
    const icon = installed ? "\u2713" : "\u2717";
    const detail = installed
      ? `configured at ${client.configPath}`
      : "found but bags-sdk-mcp not configured";
    const status = installed ? "ok" : "warn";
    console.log(`    ${client.name.padEnd(18)} ${icon} ${detail}`);
    results.push({ label: client.name, status, detail });
    checked.add(client.id);
  }

  if (clients.length === 0) {
    console.log("    No MCP clients detected");
    results.push({ label: "MCP Clients", status: "warn", detail: "no clients detected" });
  }

  return results;
}

/** Print server metadata. */
function checkServerMeta(): CheckResult[] {
  console.log("\n  Server");
  console.log(`    Version               ${SERVER_VERSION}`);
  console.log("    Tools                 46 registered");
  console.log("    Resources             4 registered");
  console.log("    Prompts               8 registered");
  return [];
}

/** Check session store state. */
function checkSessions(): CheckResult[] {
  const results: CheckResult[] = [];
  console.log("\n  Sessions");

  if (!existsSync(SESSIONS_PATH)) {
    console.log("    Store                 no sessions file");
    return results;
  }

  try {
    const raw = readFileSync(SESSIONS_PATH, "utf8");
    const store = JSON.parse(raw) as Record<string, { createdAt?: number }>;
    const entries = Object.values(store);
    const now = Date.now();
    const expired = entries.filter((s) => now - (s.createdAt ?? 0) > SESSION_TTL_MS).length;
    const active = entries.length - expired;

    console.log(`    Active                ${active}`);
    console.log(`    Expired               ${expired}`);
    console.log(`    Store path            .sessions/sessions.json`);

    if (expired > 0) {
      results.push({ label: "Sessions", status: "warn", detail: `${expired} expired — run --clear-sessions` });
    }
  } catch {
    console.log("    Store                 corrupted");
    results.push({ label: "Sessions", status: "warn", detail: "sessions file is corrupted" });
  }

  return results;
}

/** Print results aren't needed since we log inline, but collect issues for summary. */
function printResults(_results: CheckResult[]): void {
  /* results are printed inline during each check */
}

/** Print actionable summary and return exit code. */
function printSummary(results: CheckResult[]): number {
  const issues = results.filter((r) => r.status === "fail" || r.status === "warn");

  if (issues.length === 0) {
    console.log("\n  \u2713 All checks passed\n");
    return 0;
  }

  console.log(`\n  Summary: ${issues.length} issue${issues.length === 1 ? "" : "s"} found`);

  let idx = 1;
  for (const issue of issues) {
    const prefix = issue.status === "fail" ? "\u2717" : "!";
    console.log(`    ${idx}. ${prefix} ${issue.label}: ${issue.detail}`);
    idx++;
  }
  console.log();

  return issues.some((i) => i.status === "fail") ? 1 : 0;
}

/**
 * Fetch with an AbortController timeout so doctor never hangs.
 * @param url - Request URL.
 * @param init - Fetch options.
 * @returns Fetch response.
 */
function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/** Redact a secret key for display. */
function redact(val: string): string {
  if (val.length <= REDACT_PREFIX + REDACT_SUFFIX) return "***";
  return `${val.slice(0, REDACT_PREFIX)}...${val.slice(-REDACT_SUFFIX)}`;
}

/** Format a network error into a short user-facing string. */
function formatNetworkError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "AbortError") return "timeout (5s)";
    return err.message;
  }
  return String(err);
}
