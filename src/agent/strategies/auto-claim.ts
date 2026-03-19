/** Auto-claim strategy: periodically check and claim fees above a threshold. */

import { PublicKey } from "@solana/web3.js";

import { getBagsSDK } from "../../client/bags-sdk-wrapper.js";
import { lamportsToSol, solToLamports } from "../../utils/formatting.js";
import type { AutoClaimConfig } from "../types.js";

const DEFAULT_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_MIN_THRESHOLD_SOL = 0.01;

/**
 * Run the auto-claim loop: check positions and generate claim txs when above threshold.
 * Logs unsigned transactions — the operator must sign externally.
 * @param config - Auto-claim configuration.
 */
export async function autoClaimLoop(config: AutoClaimConfig): Promise<void> {
  const sdk = getBagsSDK();
  const wallet = new PublicKey(config.walletAddress);
  const thresholdLamports = solToLamports(config.minClaimThresholdSol);

  console.error(`[auto-claim] Monitoring ${config.walletAddress}`);
  console.error(`[auto-claim] Threshold: ${config.minClaimThresholdSol} SOL`);
  console.error(`[auto-claim] Check interval: ${config.checkIntervalMs / 1000}s`);

  while (true) {
    try {
      const positions = await sdk.fee.getAllClaimablePositions(wallet);
      const claimable = positions.filter(
        (p) => p.totalClaimableLamportsUserShare >= thresholdLamports,
      );

      if (claimable.length > 0) {
        const totalLamports = claimable.reduce(
          (sum, p) => sum + p.totalClaimableLamportsUserShare,
          0,
        );

        console.error(`[auto-claim] ${claimable.length} positions ready (${lamportsToSol(String(totalLamports))} SOL)`);

        for (const pos of claimable) {
          try {
            const txs = await sdk.fee.getClaimTransaction(wallet, pos);
            for (const tx of txs) {
              const serialized = Buffer.from(tx.serialize()).toString("base64");
              console.error(`[auto-claim] TX ready: ${serialized.slice(0, 20)}...`);
            }
          } catch (err) {
            console.error(`[auto-claim] Failed to build claim TX: ${err}`);
          }
        }
      }
    } catch (err) {
      console.error(`[auto-claim] Check failed: ${err}`);
    }

    await new Promise((r) => setTimeout(r, config.checkIntervalMs));
  }
}

/**
 * Create a default auto-claim config from environment variables.
 * @returns AutoClaimConfig with wallet from env.
 */
export function defaultAutoClaimConfig(): AutoClaimConfig {
  const wallet = process.env.AGENT_WALLET_PUBKEY;
  if (!wallet) throw new Error("AGENT_WALLET_PUBKEY required for auto-claim strategy.");

  return {
    walletAddress: wallet,
    minClaimThresholdSol: DEFAULT_MIN_THRESHOLD_SOL,
    checkIntervalMs: DEFAULT_CHECK_INTERVAL_MS,
  };
}
