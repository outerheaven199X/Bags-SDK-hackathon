/** Display helpers: lamport conversion, address truncation, time formatting. */

import { LAMPORTS_PER_SOL, BPS_TOTAL } from "./constants.js";

/**
 * Convert lamports (string or number) to a human-readable SOL string.
 * @param lamports - Raw lamport value from the API.
 * @returns SOL amount with up to 9 decimal places, trailing zeros stripped.
 */
export function lamportsToSol(lamports: string | number | bigint): string {
  const value = typeof lamports === "bigint"
    ? lamports
    : typeof lamports === "string"
      ? BigInt(lamports)
      : BigInt(Math.round(lamports));
  const whole = value / BigInt(LAMPORTS_PER_SOL);
  const frac = value % BigInt(LAMPORTS_PER_SOL);
  const fracStr = frac.toString().padStart(9, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

/**
 * Convert SOL to lamports.
 * @param sol - SOL amount as a string (e.g. "0.1").
 * @returns Lamport integer as a number.
 */
export function solToLamports(sol: string | number): number {
  return Math.round(Number(sol) * LAMPORTS_PER_SOL);
}

/**
 * Truncate a Base58 address for display: first6...last4.
 * @param address - Full Base58 Solana address.
 * @returns Truncated form like "AbCdEf...xYz1".
 */
export function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Convert basis points to a percentage string.
 * @param bps - Basis points (0-10000).
 * @returns Percentage like "25.5%".
 */
export function bpsToPercent(bps: number): string {
  return `${(bps / (BPS_TOTAL / 100)).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
}

/**
 * Format a Unix timestamp (seconds) into a relative time string.
 * @param unixSeconds - Unix timestamp in seconds.
 * @returns Human-readable relative time like "3m ago" or "2h ago".
 */
export function relativeTime(unixSeconds: number): string {
  const diffSec = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}
