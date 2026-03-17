/** API response types for endpoints NOT covered by @bagsfm/bags-sdk. */

export interface BagsResponse<T> {
  success: boolean;
  response?: T;
  error?: string;
}

export type SupportedProvider =
  | "twitter"
  | "tiktok"
  | "kick"
  | "instagram"
  | "onlyfans"
  | "github"
  | "apple"
  | "google"
  | "email"
  | "solana"
  | "moltbook";

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

export interface ClaimEventsParams {
  tokenMint: string;
  mode?: "offset" | "time";
  limit?: number;
  offset?: number;
  from?: number;
  to?: number;
}
