/** Shared constants: API defaults, BPS math, rate limits, Solana program IDs. */

export const DEFAULT_API_BASE = "https://public-api-v2.bags.fm/api/v1";
export const DEFAULT_RPC_URL = "https://api.mainnet-beta.solana.com";

export const LAMPORTS_PER_SOL = 1_000_000_000;
export const BPS_TOTAL = 10_000;
export const MAX_FEE_CLAIMERS = 100;
export const LOOKUP_TABLE_THRESHOLD = 15;

export const RATE_LIMIT_PER_HOUR = 1_000;
export const RETRY_DELAY_MS = 60_000;

export const TOKEN_NAME_MAX_LENGTH = 32;
export const TOKEN_SYMBOL_MAX_LENGTH = 10;
export const TOKEN_DESCRIPTION_MAX_LENGTH = 1_000;
export const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024;

export const SERVER_NAME = "bags-sdk-mcp";
export const SERVER_VERSION = "1.0.0";
