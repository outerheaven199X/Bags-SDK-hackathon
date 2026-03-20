/** Test the API key and optionally show wallet stats. */

import { DEFAULT_API_BASE, DEFAULT_RPC_URL, LAMPORTS_PER_SOL } from "../utils/constants.js";

const FETCH_TIMEOUT_MS = 10_000;
const REDACT_PREFIX = 4;
const REDACT_SUFFIX = 3;

/**
 * Validate the API key, then show wallet stats if AGENT_WALLET_PUBKEY is set.
 */
export async function runWhoami(): Promise<void> {
  const apiKey = process.env.BAGS_API_KEY;
  if (!apiKey) {
    console.log("\n  BAGS_API_KEY is not set. Nothing to check.");
    return;
  }

  console.log(`\n  API Key: ${redact(apiKey)}`);

  const valid = await testApiKey(apiKey);
  console.log(`  Status:  ${valid ? "\u2713 valid" : "\u2717 invalid"}`);

  if (!valid) {
    console.log("  Get a key at https://dev.bags.fm\n");
    process.exit(1);
  }

  const wallet = process.env.AGENT_WALLET_PUBKEY;
  if (wallet) {
    console.log(`  Wallet:  ${wallet}`);
    await printWalletStats(wallet);
  }

  console.log();
}

/**
 * Lightweight key validation: just validates, no wallet stats.
 */
export async function runTestKey(): Promise<void> {
  const apiKey = process.env.BAGS_API_KEY;
  if (!apiKey) {
    console.log("\n  \u2717 BAGS_API_KEY is not set");
    console.log("  Get a key at https://dev.bags.fm\n");
    process.exit(1);
  }

  const valid = await testApiKey(apiKey);
  if (valid) {
    console.log("\n  \u2713 API key is valid\n");
  } else {
    console.log("\n  \u2717 API key is invalid (HTTP 401)");
    console.log("  Get a key at https://dev.bags.fm\n");
    process.exit(1);
  }
}

/**
 * Test the API key against the launch feed endpoint.
 * @param apiKey - The key to validate.
 * @returns True if the key is valid (HTTP 200).
 */
async function testApiKey(apiKey: string): Promise<boolean> {
  const base = process.env.BAGS_API_BASE || DEFAULT_API_BASE;
  const url = `${base}/token-launch/feed?limit=1`;

  try {
    const res = await fetchWithTimeout(url, { headers: { "x-api-key": apiKey } });
    return res.ok;
  } catch {
    console.log("  Warning: could not reach Bags API to validate key");
    return false;
  }
}

/** Print SOL balance and token holdings for a wallet. */
async function printWalletStats(wallet: string): Promise<void> {
  console.log("\n  Quick stats:");

  const balance = await getSolBalance(wallet);
  if (balance !== null) {
    console.log(`    SOL balance     ${balance.toFixed(3)} SOL`);
  }

  const holdings = await getTokenHoldings(wallet);
  if (holdings !== null) {
    console.log(`    Token holdings  ${holdings} token${holdings === 1 ? "" : "s"}`);
  }

  const claimable = await getClaimableInfo(wallet);
  if (claimable) {
    console.log(`    Claimable fees  ${claimable.sol.toFixed(3)} SOL across ${claimable.positions} position${claimable.positions === 1 ? "" : "s"}`);
  }
}

/** Get SOL balance from RPC. */
async function getSolBalance(wallet: string): Promise<number | null> {
  const rpcUrl = process.env.SOLANA_RPC_URL || DEFAULT_RPC_URL;
  try {
    const res = await fetchWithTimeout(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [wallet] }),
    });
    const json = await res.json() as { result?: { value?: number } };
    const lamports = json.result?.value;
    return lamports != null ? lamports / LAMPORTS_PER_SOL : null;
  } catch {
    return null;
  }
}

/** Get token account count from RPC. */
async function getTokenHoldings(wallet: string): Promise<number | null> {
  const rpcUrl = process.env.SOLANA_RPC_URL || DEFAULT_RPC_URL;
  try {
    const res = await fetchWithTimeout(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [wallet, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, { encoding: "jsonParsed" }],
      }),
    });
    const json = await res.json() as { result?: { value?: unknown[] } };
    return json.result?.value?.length ?? null;
  } catch {
    return null;
  }
}

/** Get claimable fee positions from Bags API. */
async function getClaimableInfo(wallet: string): Promise<{ sol: number; positions: number } | null> {
  const apiKey = process.env.BAGS_API_KEY;
  if (!apiKey) return null;

  const base = process.env.BAGS_API_BASE || DEFAULT_API_BASE;
  const url = `${base}/fee-share/claimable-positions?walletAddress=${wallet}`;

  try {
    const res = await fetchWithTimeout(url, { headers: { "x-api-key": apiKey } });
    if (!res.ok) return null;

    const json = await res.json() as { success?: boolean; data?: Array<{ claimableAmount?: number }> };
    if (!json.success || !Array.isArray(json.data)) return null;

    const positions = json.data.length;
    const totalLamports = json.data.reduce((sum, p) => sum + (p.claimableAmount ?? 0), 0);
    return { sol: totalLamports / LAMPORTS_PER_SOL, positions };
  } catch {
    return null;
  }
}

/** Fetch with timeout. */
function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/** Redact a secret for display. */
function redact(val: string): string {
  if (val.length <= REDACT_PREFIX + REDACT_SUFFIX) return "***";
  return `${val.slice(0, REDACT_PREFIX)}...${val.slice(-REDACT_SUFFIX)}`;
}
