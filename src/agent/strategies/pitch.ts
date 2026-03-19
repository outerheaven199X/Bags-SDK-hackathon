/** Terminal display formatting for scout launch packages. */

import { bpsToPercent } from "../../utils/formatting.js";
import type { LaunchPackage } from "./scout-types.js";

const BOX_WIDTH = 42;
const DIVIDER = "═".repeat(BOX_WIDTH);
const THIN_DIVIDER = "─".repeat(BOX_WIDTH);

/**
 * Format a list of scout results as a boxed terminal display.
 * @param packages - Launch packages to display.
 * @returns Multi-line string for stdout.
 */
export function formatScoutResults(packages: LaunchPackage[]): string {
  if (packages.length === 0) {
    return wrapBox(["  No ideas this cycle. Waiting for next scan..."]);
  }

  const lines: string[] = [];
  lines.push(`  SCOUT FOUND ${packages.length} IDEA${packages.length > 1 ? "S" : ""}`);
  lines.push(THIN_DIVIDER);
  lines.push("");

  for (let i = 0; i < packages.length; i++) {
    lines.push(...formatPackageSummary(packages[i], i + 1));
    lines.push("");
  }

  lines.push(THIN_DIVIDER);
  lines.push("  Commands:");

  for (let i = 0; i < packages.length; i++) {
    const pkg = packages[i];
    lines.push(`  launch ${i + 1}  — launch ${pkg.symbol}`);
  }

  lines.push("  edit N    — modify before launch");
  lines.push("  skip      — skip this cycle");
  lines.push("  details N — show full package");

  return wrapBox(lines);
}

/**
 * Format a single package as a compact summary block.
 * @param pkg - The launch package.
 * @param index - Display index (1-based).
 * @returns Array of lines for this package.
 */
function formatPackageSummary(pkg: LaunchPackage, index: number): string[] {
  const imageStatus = pkg.imageUrl ? "✓ generated" : "✗ no image";
  const feeDesc = formatFeeShort(pkg.feeConfig);

  return [
    `  ${index}. ${pkg.name} ($${pkg.symbol})`,
    `     "${truncateText(pkg.description, 36)}"`,
    `     Image: ${imageStatus}`,
    `     Fees: ${feeDesc}`,
    `     Source: ${pkg.source}`,
  ];
}

/**
 * Format a full package detail view for the "details N" command.
 * @param pkg - The launch package to display in detail.
 * @returns Multi-line string with all package fields.
 */
export function formatPackageDetail(pkg: LaunchPackage): string {
  const lines: string[] = [];
  lines.push(`  PACKAGE DETAIL: ${pkg.name}`);
  lines.push(THIN_DIVIDER);
  lines.push(`  ID:          ${pkg.id}`);
  lines.push(`  Name:        ${pkg.name}`);
  lines.push(`  Symbol:      $${pkg.symbol}`);
  lines.push(`  Description: ${pkg.description}`);
  lines.push(`  Image:       ${pkg.imageUrl ?? "(none)"}`);
  lines.push(`  Image prompt: ${pkg.imagePrompt}`);
  lines.push("");
  lines.push("  Fee config:");
  lines.push(`    Template: ${pkg.feeConfig.template}`);

  for (const r of pkg.feeConfig.recipients) {
    lines.push(`    ${r.provider}:${r.username} — ${bpsToPercent(r.bps)}`);
  }

  lines.push("");
  lines.push(`  Source:    ${pkg.source}`);
  lines.push(`  Reasoning: ${pkg.reasoning}`);
  lines.push(`  Created:   ${pkg.createdAt}`);
  lines.push(`  Status:    ${pkg.status}`);

  return wrapBox(lines);
}

/**
 * Format the result of a launch operation.
 * @param result - Launch result object with tx count and signing URL.
 * @returns Formatted string for terminal output.
 */
export function formatLaunchResult(result: {
  tokenMint?: string;
  txCount?: number;
  signingUrl?: string;
}): string {
  const lines: string[] = [];
  lines.push("  LAUNCH INITIATED");
  lines.push(THIN_DIVIDER);

  if (result.tokenMint) {
    lines.push(`  Token mint: ${result.tokenMint}`);
  }
  if (result.txCount) {
    lines.push(`  Transactions: ${result.txCount} ready to sign`);
  }
  if (result.signingUrl) {
    lines.push(`  Sign at: ${result.signingUrl}`);
  }

  lines.push("");
  lines.push("  Open the signing URL to connect your wallet");
  lines.push("  and sign the transactions.");

  return wrapBox(lines);
}

/**
 * Wrap lines in a Unicode box drawing frame.
 * @param lines - Content lines (without frame characters).
 * @returns Framed multi-line string.
 */
function wrapBox(lines: string[]): string {
  const padded = lines.map((l) => {
    const visible = stripAnsi(l);
    const pad = Math.max(0, BOX_WIDTH - visible.length);
    return `║${l}${" ".repeat(pad)}║`;
  });

  return [
    `╔${DIVIDER}╗`,
    ...padded,
    `╚${DIVIDER}╝`,
  ].join("\n");
}

/**
 * Strip ANSI escape codes for accurate length calculation.
 * @param str - String that may contain ANSI codes.
 * @returns Clean string without escape sequences.
 */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Truncate text to a max length with ellipsis.
 * @param text - Input text.
 * @param max - Maximum character count.
 * @returns Truncated string.
 */
function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

/**
 * Format fee config recipients as a short one-line summary.
 * @param feeConfig - The fee configuration from a launch package.
 * @returns Short description like "70% creator / 30% divs".
 */
function formatFeeShort(feeConfig: LaunchPackage["feeConfig"]): string {
  return feeConfig.recipients
    .map((r) => `${bpsToPercent(r.bps)} ${r.username}`)
    .join(" / ");
}
