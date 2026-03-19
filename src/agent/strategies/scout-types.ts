/** Type definitions for the scout strategy. */

export type PackageStatus = "pending" | "launched" | "skipped" | "edited";
export type ScoutSource = "bags" | "news";

export interface FeeRecipient {
  provider: string;
  username: string;
  bps: number;
}

export interface FeeConfig {
  template: string;
  recipients: FeeRecipient[];
}

export interface LaunchPackage {
  id: string;
  name: string;
  symbol: string;
  description: string;
  imagePrompt: string;
  imageUrl: string | null;
  feeConfig: FeeConfig;
  source: string;
  reasoning: string;
  createdAt: string;
  status: PackageStatus;
}

export interface ScoutConfig {
  intervalMs: number;
  sources: ScoutSource[];
  maxIdeasPerCycle: number;
  walletAddress?: string;
}

export interface ScoutCycleResult {
  packages: LaunchPackage[];
  timestamp: string;
  sourcesScanned: string[];
}
