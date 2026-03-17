/** Fee optimizer strategy: analyze fee configs and suggest improvements. */

import { bagsGet } from "../../client/bags-rest.js";
import { sonnetChat } from "../sonnet.js";
import type { LlmMessage } from "../types.js";

/**
 * Analyze fee configs for a wallet and suggest optimization opportunities.
 * @param walletAddress - Base58 admin wallet to analyze.
 * @returns Sonnet's fee optimization recommendations.
 */
export async function analyzeFeeOptimization(walletAddress: string): Promise<string> {
  const result = await bagsGet<unknown>("/fee-share/admin/list", { wallet: walletAddress });

  if (!result.success) {
    throw new Error(`Failed to fetch fee configs: ${result.error}`);
  }

  const messages: LlmMessage[] = [
    {
      role: "system",
      content: "You are a Bags.fm fee structure analyst. Review these fee configs and suggest optimizations: better splits, DividendsBot usage, partner configs, etc. Be specific.",
    },
    {
      role: "user",
      content: `Fee configs administered by ${walletAddress}:\n${JSON.stringify(result.response, null, 2)}\n\nSuggest optimizations.`,
    },
  ];

  const response = await sonnetChat(messages);
  return response.content;
}
