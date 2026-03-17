/** Type definitions for the agentic calling layer. */

export type ModelChoice = "hermes" | "sonnet";

export interface AgentDecision {
  action: string;
  params: Record<string, unknown>;
  reasoning: string;
  model: ModelChoice;
}

export interface StrategyConfig {
  name: string;
  enabled: boolean;
}

export interface AgentConfig {
  strategies: string[];
  monitor: boolean;
}

export interface AutoClaimConfig {
  walletAddress: string;
  minClaimThresholdSol: number;
  checkIntervalMs: number;
}

export interface LaunchMonitorConfig {
  keywords?: string[];
  minCreatorHistory?: number;
  alertWebhook?: string;
  checkIntervalMs: number;
}

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmResponse {
  content: string;
  model: ModelChoice;
}
