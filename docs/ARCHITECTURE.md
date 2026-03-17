# BagsSDK MCP Server — Complete Architecture Reference

## Purpose

This document describes the full implementation of bags-sdk-mcp: a batteries-included MCP server for the Bags.fm API. It is intended as a reference for generating documentation, walkthroughs, and a docs site. Everything described here exists and compiles.

---

## What This Project Is

bags-sdk-mcp is an MCP (Model Context Protocol) server that exposes the entire Bags.fm API surface as tools, resources, and prompts that any MCP-compatible AI client (Claude Desktop, Cursor, custom agents) can call through natural language.

It also includes:
- A fee config composer for building multi-party fee splits without raw BPS math
- A tiered caching layer to stay within Bags.fm's 1,000 req/hr rate limit
- An optional autonomous agent mode with dual-model orchestration (Hermes 4 + Claude Sonnet)

The zero-custody architecture means no private keys are ever stored or handled. All transaction-generating tools return unsigned base64 VersionedTransaction objects. The user signs externally with their wallet (Phantom, Solflare, Backpack).

---

## Project Structure

```
bags-sdk-mcp/
├── src/
│   ├── index.ts                    # Creates McpServer, registers all tools/resources/prompts
│   ├── transport/
│   │   ├── stdio.ts                # Default transport for Claude Desktop
│   │   └── http.ts                 # Streamable HTTP transport for remote connections
│   ├── client/
│   │   ├── bags-rest.ts            # Direct REST client (bagsGet, bagsPost) for undocumented endpoints
│   │   ├── bags-sdk-wrapper.ts     # Singleton wrapper around @bagsfm/bags-sdk
│   │   ├── restream.ts             # Stub for RestreamClient (not yet exported by SDK)
│   │   ├── cache.ts                # Tiered TTL cache with 5 levels
│   │   └── types.ts                # TypeScript types for all API responses
│   ├── tools/                      # 40 MCP tools organized by domain
│   │   ├── trading/                # quote, swap
│   │   ├── launch/                 # feed, create-info, create-tx, launch-full (composed)
│   │   ├── fees/                   # resolve-wallet, resolve-bulk, create-config, compose, admin-list, admin-transfer, admin-update, claim-events
│   │   ├── claiming/               # positions, claim, claim-all (composed)
│   │   ├── partner/                # stats, claim, config
│   │   ├── dexscreener/            # availability, order, payment
│   │   ├── agent/                  # auth-init, auth-login, wallet-list, wallet-export, keys-list, keys-create, bootstrap (composed)
│   │   ├── state/                  # pools, pool, pool-config
│   │   ├── analytics/              # creators, lifetime-fees, claim-stats, top-tokens
│   │   ├── solana/                 # send-tx, balance, holdings
│   │   └── _registry.ts            # Imports and registers all 40 tools
│   ├── resources/                  # 4 MCP resources
│   │   ├── launch-feed.ts          # bags://launches
│   │   ├── pools.ts                # bags://pools
│   │   ├── token.ts                # bags://token/{mint} (template)
│   │   └── portfolio.ts            # bags://portfolio/{wallet} (template)
│   ├── prompts/                    # 6 MCP prompts
│   │   ├── launch-token.ts         # Solo token launch workflow
│   │   ├── launch-team-token.ts    # Team launch with fee splits
│   │   ├── analyze-fees.ts         # Fee earnings analysis
│   │   ├── setup-partner.ts        # Partner config setup
│   │   ├── claim-all.ts            # Batch fee claiming
│   │   └── portfolio-overview.ts   # Full portfolio summary
│   ├── composer/                   # Fee Config Composer
│   │   ├── fee-config.ts           # FeeConfigBuilder class with fluent API
│   │   ├── templates.ts            # 5 preset templates (solo, team, creator-dividends, influencer, dao)
│   │   └── validator.ts            # BPS validation, provider validation, duplicate checking
│   ├── agent/                      # Autonomous agent mode
│   │   ├── orchestrator.ts         # Routes tasks to Hermes (fast) or Sonnet (strategic)
│   │   ├── hermes.ts               # Hermes 4 client (OpenAI-compatible, Nous API)
│   │   ├── sonnet.ts               # Claude Sonnet client (Anthropic API)
│   │   ├── types.ts                # Agent decision types, strategy interfaces
│   │   ├── cli.ts                  # CLI entry for --agent flag
│   │   └── strategies/
│   │       ├── auto-claim.ts       # Claim fees when above threshold
│   │       ├── launch-monitor.ts   # Watch feed, alert on matching criteria
│   │       ├── portfolio-rebalance.ts  # Sonnet-powered position analysis
│   │       └── fee-optimizer.ts    # Sonnet-powered fee config suggestions
│   └── utils/
│       ├── constants.ts            # API defaults, BPS math, rate limits
│       ├── errors.ts               # Actionable error messages with retry hints
│       └── formatting.ts           # lamportsToSol, truncateAddress, bpsToPercent, relativeTime
├── bin/
│   └── bags-sdk-mcp.ts             # Universal CLI: stdio (default), --http, --agent
├── examples/
│   ├── claude-desktop-config.json
│   └── cursor-config.json
├── .env.example
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── LICENSE (MIT)
└── README.md
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BAGS_API_KEY` | Yes | API key from dev.bags.fm |
| `BAGS_API_BASE` | No | Override API base URL (default: `https://public-api-v2.bags.fm/api/v1`) |
| `SOLANA_RPC_URL` | No | Solana RPC endpoint (default: mainnet-beta, Helius recommended) |
| `HELIUS_API_KEY` | No | Enables richer on-chain data |
| `NOUS_API_KEY` | Agent mode | Hermes 4 API key for fast routine decisions |
| `ANTHROPIC_API_KEY` | Agent mode | Claude Sonnet API key for strategic decisions |
| `AGENT_WALLET_PUBKEY` | Agent mode | Base58 wallet address for agent operations (read-only) |

---

## All 40 Tools — Detailed Reference

### Trading (2 tools)

**bags_quote**
- Input: `tokenMint` (string), `side` ("buy"|"sell"), `amount` (number), `slippageBps` (optional number)
- Output: Quote with inAmount, outAmount, minOutAmount, priceImpactPct
- Read-only. No transaction created.
- Uses `sdk.trade.getQuote()` with PublicKey conversion. SOL mint is used as the counterpart.

**bags_swap**
- Input: `tokenMint`, `side`, `amount`, `walletAddress`, `slippageBps` (optional)
- Output: Unsigned base64 VersionedTransaction + quote details
- First gets a quote, then calls `sdk.trade.createSwapTransaction()` with the quote response
- User must sign the transaction externally

### Launch (4 tools)

**bags_launch_feed**
- Input: `limit` (optional), `offset` (optional)
- Output: Array of recent token launches with status, metadata, creator info
- Uses REST endpoint `/token-launch/feed`
- Cached for 5 minutes (moderate TTL)

**bags_create_token_info**
- Input: `name`, `symbol`, `description`, `imageUrl`, `telegram` (opt), `twitter` (opt), `website` (opt)
- Output: `tokenMint`, `tokenMetadata`, `uri`, `status`
- Step 1 of a token launch. Uploads metadata to IPFS via Bags API.
- Uses REST endpoint `/token-launch/create`

**bags_create_launch_tx**
- Input: `ipfs` (URI from create_token_info), `tokenMint`, `wallet`, `initialBuyLamports`, `configKey`, `tipWallet` (opt), `tipLamports` (opt)
- Output: Unsigned base64 transaction
- Step 3 of a token launch (after fee config).
- Uses REST endpoint `/token-launch/transaction`

**bags_launch_token** (composed)
- Input: All token info fields + `wallet`, `claimersArray`, `basisPointsArray`, `initialBuyLamports` (opt)
- Output: All unsigned transactions (fee config + launch) in order
- Combines create_token_info → create_fee_config → create_launch_tx into one call
- Returns total transaction count and signing instructions

### Fees (8 tools)

**bags_resolve_wallet**
- Input: `provider` (twitter, tiktok, kick, instagram, onlyfans, github, apple, google, email, solana, moltbook), `username`
- Output: `provider`, `platformData` (id, username, display_name, avatar_url), `wallet`
- Resolves a social media handle to a Bags.fm Solana wallet address
- Cached permanently (immutable TTL) — social→wallet mapping never changes

**bags_resolve_wallets_bulk**
- Input: `entries` (array of {provider, username} pairs)
- Output: Array of resolved wallets with success/failure per entry
- Uses Promise.allSettled for partial failure tolerance
- Each successful resolution is individually cached

**bags_create_fee_config**
- Input: `payer`, `baseMint`, `claimersArray` (string[]), `basisPointsArray` (number[]), `partner` (opt), `partnerConfig` (opt), `tipWallet` (opt), `tipLamports` (opt)
- Output: `meteoraConfigKey`, `feeShareAuthority`, unsigned transactions
- Validates BPS sum to 10000, checks for duplicate wallets, validates array lengths
- Uses REST endpoint `/fee-share/create-config`

**bags_compose_fee_config** (builder tool)
- Input: `mode` ("custom"|"template"), `template` (opt), `creator` (opt), `recipients` (opt), `members` (opt)
- Output: Validated config with recipients, BPS, percentages, and next steps
- Does NOT submit to the API — just builds and validates
- Template options: solo, team, creator-dividends, influencer, dao
- Returns available templates for discovery

**bags_fee_admin_list**
- Input: `walletAddress`
- Output: All fee share configs administered by that wallet
- Cached for 10 minutes (stable TTL)

**bags_fee_admin_transfer**
- Input: `currentAdmin`, `newAdmin`, `configKey`
- Output: Unsigned transaction + irreversibility warning
- Transfers fee share admin rights — this cannot be undone

**bags_fee_admin_update**
- Input: `admin`, `configKey`, `claimersArray`, `basisPointsArray`
- Output: Unsigned transaction
- Updates claimers and BPS on an existing fee config
- Validates BPS and checks for duplicates before API call

**bags_claim_events**
- Input: `tokenMint`, `mode` (opt: "offset"|"time"), `limit`, `offset`, `from`, `to`
- Output: Array of claim events with timestamps and amounts
- Supports both offset pagination and time-range queries

### Claiming (3 tools)

**bags_claimable_positions**
- Input: `walletAddress`
- Output: Array of positions with baseMint, totalClaimableLamportsUserShare, claimableSol
- Uses `sdk.fee.getAllClaimablePositions()` with PublicKey
- Cached for 2 minutes (volatile TTL)

**bags_claim_fees**
- Input: `walletAddress`, `tokenMint`
- Output: Array of unsigned base64 transactions
- Finds matching position, then calls `sdk.fee.getClaimTransaction()` with the position object
- May return multiple transactions for a single claim

**bags_claim_all_fees** (composed)
- Input: `walletAddress`, `minClaimLamports` (optional, skip dust)
- Output: Array of {tokenMint, claimableSol, unsignedTransactions} per position
- Gets all positions, filters by threshold, builds claim txs for each
- Reports successes and failures separately

### Partner (3 tools)

**bags_partner_stats**
- Input: `partnerWallet`
- Output: Fee earning statistics — total earned, tokens using config, claim history
- Cached for 10 minutes (stable TTL)

**bags_partner_claim**
- Input: `partnerWallet`
- Output: Unsigned transaction for claiming partner fees

**bags_partner_config**
- Input: `partnerWallet`, `feeBps` (optional, default 2500 = 25%)
- Output: Partner configuration details
- Creates or retrieves an existing partner config

### Dexscreener (3 tools)

**bags_dexscreener_check**
- Input: `tokenMint`
- Output: `available` (boolean), pricing info if available
- Check if Dexscreener profile boosting can be purchased

**bags_dexscreener_order**
- Input: `tokenMint`, `wallet`
- Output: `orderId`, unsigned payment transaction
- Creates a boost order — must pay before it activates

**bags_dexscreener_payment**
- Input: `orderId`, `txSignature`
- Output: Payment confirmation status
- Call after the payment transaction is signed and confirmed on-chain

### Agent Auth (7 tools)

**bags_agent_auth_init**
- Input: `email` (opt), `provider` (opt) — at least one required
- Output: Auth token + message about verification
- Step 1 of agent auth flow

**bags_agent_auth_login**
- Input: `token` (from auth_init), `code` (opt)
- Output: Session credentials
- Step 2 of agent auth flow

**bags_agent_wallet_list**
- Input: none
- Output: All wallets associated with authenticated agent

**bags_agent_wallet_export**
- Input: `walletId`
- Output: Public key details (never exposes private keys)

**bags_agent_keys_list**
- Input: none
- Output: All API keys for the authenticated agent

**bags_agent_keys_create**
- Input: `name` (optional label)
- Output: New API key (shown once) + security warning

**bags_agent_bootstrap** (composed)
- Input: none
- Output: Step-by-step workflow guide for full agent setup
- Returns ordered steps: auth_init → verify → auth_login → wallet_list → keys_create → save key

### State (3 tools)

**bags_pools**
- Input: none
- Output: All active liquidity pools
- Uses REST endpoint `/pools`

**bags_pool**
- Input: `tokenMint`
- Output: Pool address, reserves, fee config, migration status
- Uses REST endpoint `/pools/{tokenMint}`

**bags_pool_config_keys**
- Input: `feeClaimerVaults` (string[])
- Output: Array of Meteora pool config key addresses
- Uses `sdk.state.getPoolConfigKeysByFeeClaimerVaults()` with PublicKey conversion

### Analytics (4 tools)

**bags_token_creators**
- Input: `tokenMint`
- Output: Creator info — wallets, social profiles, royalty BPS, isCreator flag
- Uses `sdk.state.getTokenCreators()` with PublicKey

**bags_lifetime_fees**
- Input: `tokenMint`
- Output: `lifetimeFeesLamports`, `lifetimeFeesSol`
- Uses `sdk.state.getTokenLifetimeFees()` with PublicKey

**bags_claim_stats**
- Input: `walletAddress` (opt), `tokenMint` (opt) — at least one required
- Output: Total claimed, total unclaimed, claim count
- Uses REST endpoint `/fee-share/claim-stats`

**bags_top_tokens**
- Input: none
- Output: Leaderboard of tokens ranked by lifetime trading fees
- Uses `sdk.state.getTopTokensByLifetimeFees()`

### Solana (3 tools)

**bags_send_transaction**
- Input: `signedTransaction` (base64 encoded)
- Output: Transaction signature + explorer URL
- Deserializes, broadcasts via RPC, waits for confirmation
- This is the only tool that sends anything on-chain — requires a SIGNED transaction

**bags_wallet_balance**
- Input: `walletAddress`
- Output: `balanceLamports`, `balanceSol`
- Direct Solana RPC call, no caching

**bags_token_holdings**
- Input: `walletAddress`
- Output: All SPL token accounts with mint, amount, decimals, uiAmount
- Filters to non-zero holdings
- Direct Solana RPC call via getParsedTokenAccountsByOwner

---

## 4 MCP Resources

Resources provide browsable context that AI clients can read without making a tool call.

| Resource | URI | Type | Description |
|----------|-----|------|-------------|
| launch-feed | `bags://launches` | Static | Live token launch feed, cached 5 min |
| pools | `bags://pools` | Static | All active liquidity pools, cached 5 min |
| token | `bags://token/{mint}` | Template | Composite view: pool + creators + lifetime fees |
| portfolio | `bags://portfolio/{wallet}` | Template | All claimable positions with SOL amounts |

Template resources accept a parameter in the URI path and fetch data dynamically.

---

## 6 MCP Prompts

Prompts are guided workflows that structure multi-tool operations. When a user selects a prompt, the AI receives pre-built instructions for executing a complex multi-step flow.

**bags_launch_token**
- Args: tokenName, tokenSymbol, tokenDescription, imageUrl, creatorWallet, initialBuySol
- Flow: resolve_wallet → compose_fee_config (solo) → create_token_info → create_fee_config → create_launch_tx

**bags_launch_team_token**
- Args: tokenName, tokenSymbol, tokenDescription, imageUrl, creatorWallet, teamMembers (comma-separated platform:username:percentage), initialBuySol
- Flow: resolve_wallet ×N → compose_fee_config → create_token_info → create_fee_config → create_launch_tx → dexscreener_check

**bags_analyze_fees**
- Args: target, targetType ("token"|"wallet")
- Token flow: lifetime_fees → claim_events → token_creators → claim_stats
- Wallet flow: claimable_positions → claim_stats

**bags_setup_partner**
- Args: partnerWallet, feeBps
- Flow: partner_config → partner_stats → explain usage

**bags_claim_all**
- Args: walletAddress, minClaimSol
- Flow: claimable_positions → filter by threshold → claim_all_fees → return unsigned txs

**bags_portfolio_overview**
- Args: walletAddress
- Flow (parallel): wallet_balance + token_holdings + claimable_positions + claim_stats → summarize

---

## Fee Config Composer

The FeeConfigBuilder class provides a fluent API for composing fee split configurations.

### Class API

```typescript
FeeConfigBuilder.create()                     // New empty builder
  .addRecipient(provider, username, bps)       // Add a recipient
  .addCreator(provider, username, bps)         // Alias for addRecipient
  .addDividendsBot(bps)                        // Add DividendsBot for holder dividends
  .splitEvenly(recipients)                     // Auto-calculate even BPS split
  .validate()                                  // Returns { valid: boolean, errors: string[] }
  .getRecipients()                             // Returns defensive copy of recipients
  .needsLookupTables()                         // True if >15 claimers
```

### Static Factory Methods (Templates)

```typescript
FeeConfigBuilder.soloCreator(provider, username)
// 100% to one person

FeeConfigBuilder.creatorPlusDividends(provider, username, creatorBps?)
// Creator + DividendsBot, default 50/50

FeeConfigBuilder.teamSplit(members)
// Even split across all members, remainder to first

FeeConfigBuilder.influencerLaunch(creator, influencers, options?)
// Creator (default 30%) + influencers (split remaining) + DividendsBot (default 20%)
```

### Validation Rules
- At least 1 recipient, max 100
- All BPS must be positive integers
- BPS must sum to exactly 10000
- No duplicate provider:username pairs
- Warns when >15 claimers (needs lookup tables)

### Available as MCP Tool
The `bags_compose_fee_config` tool exposes this as either `mode: "custom"` (manual recipients) or `mode: "template"` (use a preset). It returns the validated config without submitting to the API, so the user can review before committing.

---

## Tiered Caching

The cache protects against the 1,000 req/hr Bags API rate limit with five TTL tiers:

| Tier | TTL | What Gets Cached |
|------|-----|-----------------|
| Immutable | Forever | Social→wallet resolution (never changes) |
| Stable | 10 min | Creators, pool configs, partner configs |
| Moderate | 5 min | Lifetime fees, claim stats, token feed, pools |
| Volatile | 2 min | Claimable positions |
| None | 0 (never) | Quotes, transactions, auth, send-tx |

The cache is in-memory (Map-based). No external dependencies. Entries auto-expire on read. Prefix-based invalidation is available for bulk cache clearing.

---

## Agent Mode

Activated with `--agent` flag. Runs autonomous strategies in infinite loops.

### Dual-Model Routing

The orchestrator routes tasks based on complexity:

**Hermes 4** (via Nous API, OpenAI-compatible) handles:
- Checking claimable positions
- Claiming fees above threshold
- Monitoring launch feed
- Reporting portfolio status
- Any "how do I?" task

**Claude Sonnet** (via Anthropic API) handles:
- Evaluating whether a launch is worth participating in
- Composing optimal fee configs for complex team structures
- Analyzing fee flow patterns
- Generating human-readable reports
- Any "should I?" decision

Routing uses regex pattern matching on the task description. Strategic patterns (evaluate, analyze, recommend, optimize, compare, strategy) go to Sonnet. Routine patterns (claim, balance, check, list, monitor, status) go to Hermes.

### Strategies

**auto-claim** (`--auto-claim`)
- Checks positions every 5 minutes
- Claims fees above 0.01 SOL threshold
- Logs unsigned transactions (operator signs externally)
- Requires `AGENT_WALLET_PUBKEY` env var

**launch-monitor** (`--monitor`)
- Checks launch feed every 30 seconds
- Tracks seen mints to avoid duplicates
- Optional keyword filtering
- Escalates interesting launches to Sonnet for analysis

**portfolio-rebalance** (programmatic only, not CLI)
- Fetches all positions for a wallet
- Sends summary to Sonnet for rebalancing suggestions

**fee-optimizer** (programmatic only, not CLI)
- Fetches all fee configs for an admin wallet
- Sends to Sonnet for optimization suggestions (better splits, DividendsBot usage, partner configs)

---

## Transport Options

**stdio** (default)
- Standard input/output, used by Claude Desktop and MCP Inspector
- `bags-sdk-mcp` or `node dist/bin/bags-sdk-mcp.js`

**Streamable HTTP**
- Express server exposing `POST /mcp` and `GET /health`
- `bags-sdk-mcp --http` (default port 3000)
- `bags-sdk-mcp --http --port=8080`
- Each request creates a fresh server+transport (stateless)

---

## Key Implementation Details

### SDK Method Mapping

The @bagsfm/bags-sdk uses these service names (not what you might guess):

| Service | Property | Key Methods |
|---------|----------|-------------|
| Trading | `sdk.trade` | `getQuote(params)`, `createSwapTransaction(params)` |
| Fees/Claiming | `sdk.fee` | `getAllClaimablePositions(PublicKey)`, `getClaimTransaction(PublicKey, position)` |
| State | `sdk.state` | `getTokenCreators(PublicKey)`, `getTokenLifetimeFees(PublicKey)`, `getTopTokensByLifetimeFees()`, `getTokenClaimStats(PublicKey)`, `getTokenClaimEvents(PublicKey)`, `getLaunchWalletV2(username, provider)`, `getLaunchWalletV2Bulk(items)`, `getPoolConfigKeysByFeeClaimerVaults(PublicKey[])` |
| Config | `sdk.config` | `createBagsFeeShareConfig(args)` |
| Token Launch | `sdk.tokenLaunch` | `createTokenInfoAndMetadata(params)`, `createLaunchTransaction(params)` |
| Partner | `sdk.partner` | `getPartnerConfig(PublicKey)`, `getPartnerConfigCreationTransaction(PublicKey)`, `getPartnerConfigClaimStats(PublicKey)`, `getPartnerConfigClaimTransactions(PublicKey)` |
| Fee Share Admin | `sdk.feeShareAdmin` | `getAdminTokenMints(PublicKey)`, `getTransferAdminTransaction(params)`, `getUpdateConfigTransactions(params)` |
| Dexscreener | `sdk.dexscreener` | `checkOrderAvailability(params)`, `createOrder(params)`, `submitPayment(params)` |
| Solana | `sdk.solana` | `sendBundle(transactions)`, `getBundleStatuses(ids)`, `getJitoRecentFees()` |

Most SDK methods require `PublicKey` objects, not strings. The tools handle this conversion internally.

### REST Endpoints Used Directly

Some endpoints are called via the REST client (`bagsGet`/`bagsPost`) rather than the SDK:

- `/token-launch/feed` — Launch feed
- `/token-launch/create` — Create token info
- `/token-launch/transaction` — Create launch transaction
- `/fee-share/resolve-wallet` — Social→wallet resolution
- `/fee-share/create-config` — Create fee share config
- `/fee-share/admin/list` — List admin configs
- `/fee-share/admin/transfer` — Transfer admin rights
- `/fee-share/admin/update` — Update config
- `/fee-share/claim-events` — Claim event history
- `/fee-share/claim-stats` — Claim statistics
- `/pools` and `/pools/{mint}` — Pool data
- `/partner/stats`, `/partner/claim`, `/partner/config`
- `/dexscreener/availability`, `/dexscreener/order`, `/dexscreener/payment`
- `/agent/auth/init`, `/agent/auth/login`, `/agent/wallets`, `/agent/keys`

### Error Handling

Every tool wraps its handler in try/catch and uses the `mcpError()` utility which maps HTTP status codes to actionable messages:
- 401 → "Check your BAGS_API_KEY. Get one at dev.bags.fm"
- 429 → "Rate limited. BagsSDK caches responses. Retry in 60 seconds."
- 404 → "Resource not found. Verify addresses/mints are correct."
- Connection errors → "Cannot reach Bags API. Check network and BAGS_API_BASE."

---

## Common User Flows

### Flow 1: Check Portfolio
1. `bags_wallet_balance` — see SOL balance
2. `bags_token_holdings` — see all token positions
3. `bags_claimable_positions` — see unclaimed fees
4. Decide whether to claim

### Flow 2: Claim All Fees
1. `bags_claimable_positions` — review what's claimable
2. `bags_claim_all_fees` with minClaimLamports to skip dust
3. Sign each returned transaction externally
4. `bags_send_transaction` for each signed tx

### Flow 3: Launch a Solo Token
1. `bags_resolve_wallet` — get creator's Bags wallet
2. `bags_create_token_info` — upload metadata to IPFS
3. `bags_create_fee_config` — set up 100% to creator
4. `bags_create_launch_tx` — build the launch transaction
5. Sign fee config tx(s) first, then launch tx
6. `bags_send_transaction` for each

### Flow 4: Launch a Team Token with Fee Splits
1. `bags_resolve_wallet` ×N — resolve all team members
2. `bags_compose_fee_config` — validate the split (e.g., 50/30/20)
3. `bags_create_token_info` — upload metadata
4. `bags_create_fee_config` — create on-chain config with all wallets
5. `bags_create_launch_tx` — build launch tx
6. Sign all txs in order
7. Optional: `bags_dexscreener_check` for boost availability

### Flow 5: Analyze a Token
1. `bags_lifetime_fees` — total fees collected
2. `bags_token_creators` — who's earning
3. `bags_claim_events` — recent claim activity
4. `bags_claim_stats` — aggregate stats

### Flow 6: Set Up as a Partner
1. `bags_partner_config` — create partner config (default 25% fee)
2. Share the partner wallet and config address with token creators
3. When creators use your config in `bags_create_fee_config`, you earn fees
4. `bags_partner_stats` — check earnings
5. `bags_partner_claim` — claim partner fees

### Flow 7: Agent Bootstrap
1. `bags_agent_auth_init` with email
2. Check email for verification code
3. `bags_agent_auth_login` with token + code
4. `bags_agent_wallet_list` — discover wallets
5. `bags_agent_keys_create` — get an API key
6. Save key as BAGS_API_KEY in .env

---

## Technology Stack

| Layer | Choice | Version |
|-------|--------|---------|
| Language | TypeScript (strict mode) | 5.8+ |
| MCP SDK | @modelcontextprotocol/sdk | ^1.12.0 |
| Bags SDK | @bagsfm/bags-sdk | ^1.2.7 (installed 1.3.1) |
| Solana | @solana/web3.js | ^1.95.0 |
| Schema | zod | ^3.25.0 |
| HTTP server | express | ^4.21.0 |
| Build | tsc | (via typescript) |
| Test | vitest | ^3.0.0 |
| Agent LLM (fast) | Hermes 4 | Nous API, OpenAI-compatible |
| Agent LLM (strategic) | Claude Sonnet | Anthropic API |

---

## CLI Reference

```
bags-sdk-mcp                              # stdio MCP server (default)
bags-sdk-mcp --http                       # Streamable HTTP on port 3000
bags-sdk-mcp --http --port=8080           # Custom port
bags-sdk-mcp --agent                      # Agent mode (no strategies = help text)
bags-sdk-mcp --agent --auto-claim         # Auto-claim strategy
bags-sdk-mcp --agent --monitor            # Launch monitor strategy
bags-sdk-mcp --agent --auto-claim --monitor  # Both strategies
bags-sdk-mcp --help                       # Print usage
```
