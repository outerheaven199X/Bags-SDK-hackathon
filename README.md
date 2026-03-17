# bags-sdk-mcp

The developer toolkit Bags.fm should ship as their official platform.

40 tools. 4 resources. 6 prompts. Fee-config composer. Dual-model agent mode.

[![npm](https://img.shields.io/npm/v/bags-sdk-mcp)](https://www.npmjs.com/package/bags-sdk-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built for Bags Hackathon 2026](https://img.shields.io/badge/Bags%20Hackathon-Q1%202026-7C3AED)](https://bags.fm)

---

## Install

```bash
npx bags-sdk-mcp
```

That's it. One line. API key required — get one at [dev.bags.fm](https://dev.bags.fm).

## Claude Desktop Setup

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bags-sdk-mcp": {
      "command": "npx",
      "args": ["bags-sdk-mcp"],
      "env": {
        "BAGS_API_KEY": "your-key-here"
      }
    }
  }
}
```

## What You Get

### vs bagsx-mcp (the only other Bags MCP server)

| Feature | bagsx-mcp | bags-sdk-mcp |
|---------|-----------|-------------|
| Tools | 19 | **40** |
| MCP Resources | 0 | **4** |
| MCP Prompts | 0 | **6** |
| Tool annotations | No | **Yes** |
| Agent API (6 endpoints) | No | **Yes** |
| Dexscreener API (3 endpoints) | No | **Yes** |
| Fee Share Admin (3 endpoints) | No | **Yes** |
| Fee Config Composer | No | **Yes** |
| Tiered caching (1k req/hr) | No | **Yes** |
| Streamable HTTP transport | No | **Yes** |
| Autonomous agent mode | No | **Yes** |

### 40 Tools by Domain

| Domain | Tools | Description |
|--------|-------|-------------|
| **Trading** | `bags_quote`, `bags_swap` | Price quotes and unsigned swap transactions |
| **Launch** | `bags_launch_feed`, `bags_create_token_info`, `bags_create_launch_tx`, `bags_launch_token` | Full token launch lifecycle |
| **Fees** | `bags_resolve_wallet`, `bags_resolve_wallets_bulk`, `bags_create_fee_config`, `bags_compose_fee_config`, `bags_fee_admin_list`, `bags_fee_admin_transfer`, `bags_fee_admin_update`, `bags_claim_events` | Fee sharing setup and management |
| **Claiming** | `bags_claimable_positions`, `bags_claim_fees`, `bags_claim_all_fees` | Fee claiming with batch support |
| **Partner** | `bags_partner_stats`, `bags_partner_claim`, `bags_partner_config` | Partner program integration |
| **Dexscreener** | `bags_dexscreener_check`, `bags_dexscreener_order`, `bags_dexscreener_payment` | Dexscreener profile boosting |
| **Agent Auth** | `bags_agent_auth_init`, `bags_agent_auth_login`, `bags_agent_wallet_list`, `bags_agent_wallet_export`, `bags_agent_keys_list`, `bags_agent_keys_create`, `bags_agent_bootstrap` | Agent lifecycle management |
| **State** | `bags_pools`, `bags_pool`, `bags_pool_config_keys` | Pool and config queries |
| **Analytics** | `bags_token_creators`, `bags_lifetime_fees`, `bags_claim_stats` | Token and fee analytics |
| **Solana** | `bags_send_transaction`, `bags_wallet_balance`, `bags_token_holdings` | On-chain operations |

### 4 Resources

| URI | Description |
|-----|-------------|
| `bags://launches` | Live token launch feed |
| `bags://pools` | All active liquidity pools |
| `bags://token/{mint}` | Composite token detail (pool + creators + fees) |
| `bags://portfolio/{wallet}` | Claimable positions + earnings summary |

### 6 Prompts

| Prompt | Description |
|--------|-------------|
| `bags_launch_token` | Guided solo token launch |
| `bags_launch_team_token` | Team launch with multi-party fee splits |
| `bags_analyze_fees` | Fee earnings analysis |
| `bags_setup_partner` | Partner config setup |
| `bags_claim_all` | Batch fee claiming |
| `bags_portfolio_overview` | Full position + earnings summary |

## Fee Config Composer

The flagship differentiator. Build complex fee splits without touching raw BPS arrays.

```typescript
// Solo creator — 100% of fees
FeeConfigBuilder.soloCreator("twitter", "nikki");

// Creator + holder dividends — 50/50
FeeConfigBuilder.creatorPlusDividends("twitter", "nikki", 5000);

// Team split — even across all members
FeeConfigBuilder.teamSplit([
  { provider: "twitter", username: "alice" },
  { provider: "twitter", username: "bob" },
  { provider: "twitter", username: "carol" },
]);

// Influencer launch — creator 30%, influencers 50%, dividends 20%
FeeConfigBuilder.influencerLaunch(
  { provider: "twitter", username: "nikki" },
  [
    { provider: "twitter", username: "influencer1" },
    { provider: "twitter", username: "influencer2" },
  ],
  { creatorBps: 3000, dividendsBps: 2000 }
);
```

Exposed as both a TypeScript class and the `bags_compose_fee_config` MCP tool.

## Zero-Custody Architecture

BagsSDK never touches private keys. Every transaction-generating tool returns unsigned base64-encoded `VersionedTransaction` objects. You sign externally with Phantom, Solflare, or Backpack.

## Agent Mode

Optional autonomous operation with dual-model orchestration:

```bash
# Auto-claim fees when above threshold
bags-sdk-mcp --agent --auto-claim

# Monitor launch feed for matching criteria
bags-sdk-mcp --agent --monitor

# Both strategies concurrently
bags-sdk-mcp --agent --auto-claim --monitor
```

**Hermes 4** (via Nous API) handles fast routine operations: checking positions, claiming fees, monitoring feeds.

**Claude Sonnet** (via Anthropic API) handles strategic decisions: evaluating launches, composing fee configs, generating analysis reports.

## Transports

```bash
# stdio (default, for Claude Desktop)
bags-sdk-mcp

# Streamable HTTP (for remote connections)
bags-sdk-mcp --http
bags-sdk-mcp --http --port=8080
```

## Environment Variables

```env
# Required
BAGS_API_KEY=                    # From dev.bags.fm

# Optional
SOLANA_RPC_URL=                  # Default: mainnet-beta (Helius recommended)
HELIUS_API_KEY=                  # Richer on-chain data

# Agent mode only
NOUS_API_KEY=                    # Hermes 4 for fast decisions
ANTHROPIC_API_KEY=               # Sonnet for strategic decisions
AGENT_WALLET_PUBKEY=             # Read-only wallet for agent operations
```

## Demo

One natural language sentence → 6+ tool calls → team token launched with multi-party fee splits.

> "Launch a token called BAGS SDK with symbol BSDK. Split fees: 70% to me (@nikki on twitter), 20% to @alice on twitter, 10% to @DividendsBot. Buy 0.1 SOL on launch."

Claude executes: `bags_resolve_wallet` ×3 → `bags_compose_fee_config` → `bags_create_token_info` → `bags_create_fee_config` → `bags_create_launch_tx` → `bags_dexscreener_check`

Returns all unsigned transactions. You sign. Token is live.

## Development

```bash
git clone https://github.com/antimeme/bags-sdk-mcp
cd bags-sdk-mcp
npm install
npm run build
npm run inspect    # Open MCP Inspector
```

## License

MIT
