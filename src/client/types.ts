/** API response types for endpoints NOT covered by @bagsfm/bags-sdk. */

export interface BagsResponse<T> {
  success: boolean;
  response?: T;
  error?: string;
}

/** Canonical list of supported social providers — single source of truth for both type and runtime checks. */
export const SUPPORTED_PROVIDERS = [
  "twitter", "tiktok", "kick", "instagram", "onlyfans",
  "github", "apple", "google", "email", "solana", "moltbook",
] as const;

export type SupportedProvider = typeof SUPPORTED_PROVIDERS[number];

export interface FeeShareWalletResponse {
  provider: string;
  platformData: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string;
  };
  wallet: string;
}

export interface CreateFeeShareConfigBody {
  payer: string;
  baseMint: string;
  claimersArray: string[];
  basisPointsArray: number[];
  partner?: string;
  partnerConfig?: string;
  additionalLookupTables?: string[];
  tipWallet?: string;
  tipLamports?: number;
}

export interface TransactionBundle {
  blockhash: { blockhash: string; lastValidBlockHeight: number };
  transaction: string;
}

export interface CreateFeeShareConfigResponse {
  needsCreation: boolean;
  feeShareAuthority: string;
  meteoraConfigKey: string;
  transactions: TransactionBundle[];
  bundles?: TransactionBundle[][];
}

export interface CreateTokenInfoBody {
  name: string;
  symbol: string;
  description: string;
  image?: File;
  imageUrl?: string;
  metadataUrl?: string;
  telegram?: string | null;
  twitter?: string | null;
  website?: string | null;
}

export interface TokenLaunchInfo {
  name: string;
  symbol: string;
  description: string;
  image: string;
  tokenMint: string;
  status: "PRE_LAUNCH";
  uri: string;
}

export interface CreateTokenInfoResponse {
  tokenMint: string;
  tokenMetadata: string;
  tokenLaunch: TokenLaunchInfo;
}

export interface CreateLaunchTransactionBody {
  ipfs: string;
  tokenMint: string;
  wallet: string;
  initialBuyLamports: number;
  configKey: string;
  tipWallet?: string;
  tipLamports?: number;
}

export interface AgentAuthInitBody {
  email?: string;
  provider?: string;
}

export interface AgentAuthLoginBody {
  token: string;
  code?: string;
}

export interface DexscreenerAvailabilityResponse {
  available: boolean;
  tokenMint: string;
  pricing?: {
    amount: number;
    currency: string;
  };
}

export interface CreatePartnerConfigBody {
  partnerWallet: string;
  feeBps?: number;
}

/** Shape returned by sdk.fee.getAllClaimablePositions — local mirror since SDK doesn't export it. */
export interface ClaimablePosition {
  baseMint: string;
  quoteMint?: string;
  programId: string;
  isCustomFeeVault?: boolean;
  virtualPool?: string;
  virtualPoolAddress?: string;
  isMigrated?: boolean;
  dammPositionInfo?: DammPositionInfo;
  totalClaimableLamportsUserShare: number;
}

/** DAMM V2 position detail embedded in a claimable position. */
export interface DammPositionInfo {
  pool: string;
  position: string;
  positionNftAccount: string;
  tokenAMint: string;
  tokenBMint: string;
  tokenAVault: string;
  tokenBVault: string;
}

export interface ClaimEventsParams {
  tokenMint: string;
  mode?: "offset" | "time";
  limit?: number;
  offset?: number;
  from?: number;
  to?: number;
}
