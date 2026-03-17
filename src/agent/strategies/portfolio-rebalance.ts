/** Portfolio rebalance strategy: suggest rebalancing based on current positions. */

import { PublicKey } from "@solana/web3.js";

import { getBagsSDK } from "../../client/bags-sdk-wrapper.js";
import { sonnetChat } from "../sonnet.js";
import { lamportsToSol } from "../../utils/formatting.js";
import type { LlmMessage } from "../types.js";

/**
 * Analyze a wallet's positions and generate rebalancing suggestions via Sonnet.
 * @param walletAddress - Base58 wallet to analyze.
 * @returns Sonnet's rebalancing recommendations as a string.
 */
export async function analyzePortfolioRebalance(walletAddress: string): Promise<string> {
  const sdk = getBagsSDK();
  const positions = await sdk.fee.getAllClaimablePositions(new PublicKey(walletAddress));

  const summary = positions.map((p) => ({
    baseMint: "baseMint" in p ? String(p.baseMint) : "unknown",
    claimable: lamportsToSol(String(p.totalClaimableLamportsUserShare)),
  }));

  const messages: LlmMessage[] = [
    {
      role: "system",
      content: "You are a DeFi portfolio analyst for Bags.fm. Analyze the positions and suggest which to claim, hold, or exit. Be concise.",
    },
    {
      role: "user",
      content: `Portfolio for ${walletAddress}:\n${JSON.stringify(summary, null, 2)}\n\nSuggest rebalancing actions.`,
    },
  ];

  const response = await sonnetChat(messages);
  return response.content;
}
