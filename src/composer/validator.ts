/** Standalone validation utilities for fee config data before API submission. */

import { BPS_TOTAL, MAX_FEE_CLAIMERS, LOOKUP_TABLE_THRESHOLD } from "../utils/constants.js";
import { SUPPORTED_PROVIDERS } from "../client/types.js";
import type { SupportedProvider } from "../client/types.js";

const VALID_PROVIDERS = new Set<SupportedProvider>(SUPPORTED_PROVIDERS);

/**
 * Validate that a provider string is one of the accepted Bags platforms.
 * @param provider - The provider to check.
 * @returns True if it's a known Bags provider.
 */
export function isValidProvider(provider: string): provider is SupportedProvider {
  return VALID_PROVIDERS.has(provider as SupportedProvider);
}

/**
 * Validate a BPS array against Bags constraints.
 * @param bpsArray - Array of basis point allocations.
 * @returns Object with validity flag and any error messages.
 */
export function validateBpsArray(bpsArray: number[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (bpsArray.length === 0) {
    errors.push("BPS array cannot be empty.");
  }
  if (bpsArray.length > MAX_FEE_CLAIMERS) {
    errors.push(`Maximum ${MAX_FEE_CLAIMERS} claimers allowed.`);
  }

  const total = bpsArray.reduce((sum, v) => sum + v, 0);
  if (total !== BPS_TOTAL) {
    errors.push(`BPS must sum to ${BPS_TOTAL}. Got ${total}.`);
  }

  for (let i = 0; i < bpsArray.length; i++) {
    if (!Number.isInteger(bpsArray[i]) || bpsArray[i] <= 0) {
      errors.push(`BPS at index ${i} must be a positive integer. Got ${bpsArray[i]}.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check if the claimer count requires additional lookup tables.
 * @param claimerCount - Number of fee claimers.
 * @returns True if lookup tables are needed (>15 claimers).
 */
export function needsLookupTables(claimerCount: number): boolean {
  return claimerCount > LOOKUP_TABLE_THRESHOLD;
}

/**
 * Check for duplicate wallet addresses in a claimers array.
 * @param wallets - Array of Base58 wallet addresses.
 * @returns Array of duplicate addresses found, empty if none.
 */
export function findDuplicateWallets(wallets: string[]): string[] {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const w of wallets) {
    if (seen.has(w)) dupes.push(w);
    seen.add(w);
  }
  return dupes;
}
