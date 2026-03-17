# bags-sdk-mcp

Connect Bags.fm to any MCP-compatible AI agent. Launch, manage, and monitor your coins from your terminal.

[![npm](https://img.shields.io/npm/v/bags-sdk-mcp)](https://www.npmjs.com/package/bags-sdk-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Get started

**You need one thing:** a Bags API key from [dev.bags.fm](https://dev.bags.fm).

### Option A: Claude Desktop / Cursor

Add this to your MCP config:

```json
{
  "mcpServers": {
    "bags-sdk-mcp": {
      "command": "npx",
      "args": ["bags-sdk-mcp"],
      "env": {
        "BAGS_API_KEY": "your-key-here",
        "SOLANA_RPC_URL": "https://api.mainnet-beta.solana.com"
      }
    }
  }
}
```

Config file locations:
- **Claude Desktop (Windows):** `%APPDATA%/Claude/claude_desktop_config.json`
- **Claude Desktop (Mac):** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Cursor:** `.cursor/mcp.json` in your project root

### Option B: From source

```bash
git clone https://github.com/outerheaven199X/bags-sdk-mcp.git
cd bags-sdk-mcp
cp .env.example .env       # add your BAGS_API_KEY
npm install && npm run build
npm start
```

### Option C: HTTP transport (remote/serverless)

```bash
bags-sdk-mcp --http                  # port 3000
bags-sdk-mcp --http --port=8080      # custom port
```

---

## Launch a coin (step by step)

Launching costs real SOL. The server returns unsigned transactions at every step so you review and sign each one before anything hits the chain.

### Step 1 — Upload metadata

Tell your agent the token name, symbol, description, and image URL.

```
"Create token info for a coin called BAGS SDK, symbol BSDK,
 description 'The official Bags SDK hackathon coin',
 image https://i.imgur.com/3fZ6VWG.png"
```

Tool called: `bags_create_token_info` — uploads metadata to IPFS, returns a `tokenMint` and `uri`.

### Step 2 — Set up fee sharing

Decide who earns trading fees and in what split. BPS must add up to 10000 (100%).

```
"Create a fee config: 100% to my wallet 83xQ...biH"
```

Tool called: `bags_create_fee_config` — returns unsigned transaction(s) and a `meteoraConfigKey`.

**Sign and send the fee config transaction(s) first.**

### Step 3 — Build the launch transaction

```
"Build the launch transaction with 0.1 SOL initial buy"
```

Tool called: `bags_create_launch_tx` — returns one more unsigned transaction.

**Sign and send. Your coin is live.**

### One-shot alternative

If you want all three steps composed into a single call:

```
"Launch a token called BAGS SDK, symbol BSDK, 100% fees to my wallet,
 0.1 SOL initial buy"
```

Tool called: `bags_launch_token` — returns all unsigned transactions in signing order.

You still sign each one individually.

---

## What's in the box

### 40 tools

| Domain | Tools | What they do |
|--------|-------|-------------|
| **Trading** | `quote`, `swap` | Price quotes, unsigned swap txs |
| **Launch** | `launch_feed`, `create_token_info`, `create_launch_tx`, `launch_token` | Full token launch lifecycle |
| **Fees** | `resolve_wallet`, `resolve_wallets_bulk`, `create_fee_config`, `compose_fee_config`, `fee_admin_list`, `fee_admin_transfer`, `fee_admin_update`, `claim_events` | Fee sharing setup and management |
| **Claiming** | `claimable_positions`, `claim_fees`, `claim_all_fees` | Find and claim earned fees |
| **Partner** | `partner_stats`, `partner_claim`, `partner_config` | Referral program |
| **Dexscreener** | `dexscreener_check`, `dexscreener_order`, `dexscreener_payment` | Profile boosting |
| **Agent Auth** | `agent_auth_init`, `agent_auth_login`, `agent_wallet_list`, `agent_wallet_export`, `agent_keys_list`, `agent_keys_create`, `agent_bootstrap` | Agent identity and wallet management |
| **State** | `pools`, `pool`, `pool_config_keys` | Liquidity pool data |
| **Analytics** | `token_creators`, `lifetime_fees`, `claim_stats`, `top_tokens` | On-chain analytics |
| **Solana** | `send_transaction`, `wallet_balance`, `token_holdings` | RPC utilities |

All tool names are prefixed with `bags_`.

### 4 resources

| URI | Description |
|-----|-------------|
| `bags://launches` | Live token launch feed |
| `bags://pools` | Active liquidity pools |
| `bags://token/{mint}` | Token detail: pool + creators + fees |
| `bags://portfolio/{wallet}` | Claimable positions + earnings |

### 6 prompts

Guided multi-step workflows: `launch_token`, `launch_team_token`, `analyze_fees`, `setup_partner`, `claim_all`, `portfolio_overview`.

---

## Fee config composer

Build fee splits without doing BPS math by hand.

```typescript
// 100% to you
FeeConfigBuilder.soloCreator("twitter", "yourhandle");

// 50/50 with holder dividends
FeeConfigBuilder.creatorPlusDividends("twitter", "yourhandle", 5000);

// Even split across a team
FeeConfigBuilder.teamSplit([
  { provider: "twitter", username: "alice" },
  { provider: "twitter", username: "bob" },
  { provider: "twitter", username: "carol" },
]);
```

Also available as the `bags_compose_fee_config` tool for preview before committing on-chain.

---

## Agent mode

Autonomous strategies with dual-model routing.

```bash
bags-sdk-mcp --agent --auto-claim     # claim fees above threshold every 5 min
bags-sdk-mcp --agent --monitor        # watch launch feed, flag interesting ones
bags-sdk-mcp --agent --auto-claim --monitor   # both
```

Requires `NOUS_API_KEY` (Hermes 4 for fast ops) and `ANTHROPIC_API_KEY` (Sonnet for strategy).

---

## Environment variables

```env
# Required
BAGS_API_KEY=                    # from dev.bags.fm

# Optional
SOLANA_RPC_URL=                  # default: mainnet-beta
BAGS_API_BASE=                   # default: https://public-api-v2.bags.fm/api/v1

# Agent mode
NOUS_API_KEY=                    # Hermes 4
ANTHROPIC_API_KEY=               # Claude Sonnet
AGENT_WALLET_PUBKEY=             # read-only wallet for agent ops
```

The server loads `.env` from your working directory automatically.

---

## Security

No private keys pass through this server. Every transaction-generating tool returns unsigned base64. You sign with your own wallet (Phantom, Solflare, Backpack) and broadcast with `bags_send_transaction`.

---

## Development

```bash
npm run build          # compile TypeScript
npm run dev            # watch mode
npm run inspect        # open MCP Inspector
npm test               # run tests
```

## License

MIT
