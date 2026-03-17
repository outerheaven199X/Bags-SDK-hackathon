<h1 align="center">Bags SDK — MCP Server</h1>

<p align="center">
  Launch a coin in 3 steps from your terminal.<br/>
  41 MCP tools. Fee splits, claims, Dexscreener, agent auth.<br/>
  Your AI handles the rest.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/bags-sdk-mcp"><img src="https://img.shields.io/npm/v/bags-sdk-mcp?style=flat-square&color=00ff41" alt="npm" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-00ff41?style=flat-square" alt="MIT" /></a>
  <a href="https://dev.bags.fm"><img src="https://img.shields.io/badge/API_Key-dev.bags.fm-00ff41?style=flat-square" alt="API Key" /></a>
</p>

---

## Setup

1. Get an API key from [dev.bags.fm](https://dev.bags.fm)
2. Add this to your MCP config:

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

3. Restart your client. Done.

<details>
<summary>Config file locations</summary>

| Client | Path |
|--------|------|
| Claude Desktop (Windows) | `%APPDATA%/Claude/claude_desktop_config.json` |
| Claude Desktop (Mac) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Cursor | `.cursor/mcp.json` in project root |
| Claude Code | `.mcp.json` in project root |

</details>

<details>
<summary>From source</summary>

```bash
git clone https://github.com/outerheaven199X/Bags-SDK-hackathon.git
cd Bags-SDK-hackathon
cp .env.example .env       # add your BAGS_API_KEY
npm install && npm run build
npm start
```

</details>

<details>
<summary>HTTP transport</summary>

```bash
bags-sdk-mcp --http                  # port 3000
bags-sdk-mcp --http --port=8080      # custom port
```

</details>

---

## Launch a Coin

```
You:    "Launch a coin called bori, symbol BOOL, 0.001 SOL initial buy"
Agent:  shows summary, asks for confirmation
You:    "Go"
Agent:  opens signing page → connect wallet → sign twice → live
```

That's it. The signing page runs on localhost — connect Phantom, Solflare, Backpack, or Coinbase, approve two transactions, and your coin is on-chain. No raw transactions, no clipboard, no jargon.

---

## What Else Can It Do

| Say this | Get this |
|----------|----------|
| "What's trending on Bags?" | Recent launches + top tokens |
| "Check my wallet" | Balance, holdings, claimable fees |
| "Claim all my fees" | Finds and claims every open position |
| "Set up a 50/50 fee split" | Fee config built and signed |
| "List on Dexscreener" | Profile boost order placed |
| "Show pool data for $TOKEN" | Reserves, config, migration status |

---

## 41 Tools

| Domain | Tools |
|--------|-------|
| **Trading** | `quote` `swap` |
| **Launch** | `launch_feed` `create_token_info` `create_launch_tx` `launch_token` |
| **Fees** | `resolve_wallet` `resolve_wallets_bulk` `create_fee_config` `compose_fee_config` `fee_admin_list` `fee_admin_transfer` `fee_admin_update` `claim_events` |
| **Claiming** | `claimable_positions` `claim_fees` `claim_all_fees` |
| **Partner** | `partner_stats` `partner_claim` `partner_config` |
| **Dexscreener** | `dexscreener_check` `dexscreener_order` `dexscreener_payment` |
| **Agent Auth** | `agent_auth_init` `agent_auth_login` `agent_wallet_list` `agent_wallet_export` `agent_keys_list` `agent_keys_create` `agent_bootstrap` |
| **State** | `pools` `pool` `pool_config_keys` |
| **Analytics** | `token_creators` `lifetime_fees` `claim_stats` `top_tokens` |
| **Solana** | `send_transaction` `wallet_balance` `token_holdings` |
| **Signing** | `open_signing_page` `open_launch_page` |
| **Meta** | `tool_catalog` |

All prefixed with `bags_`.

---

## Fee Splits Without Math

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

Or use the `bags_compose_fee_config` tool and preview before committing on-chain.

---

## Agent Mode

```bash
bags-sdk-mcp --agent --auto-claim      # claim fees every 5 min
bags-sdk-mcp --agent --monitor         # watch launches, flag interesting ones
bags-sdk-mcp --agent --auto-claim --monitor
```

Requires `NOUS_API_KEY` and `ANTHROPIC_API_KEY`.

---

## Security

No private keys pass through this server. Every tool returns unsigned transaction data. The signing page connects directly to your browser wallet — keys never leave your device.

---

## Environment Variables

| Variable | Required | Default |
|----------|----------|---------|
| `BAGS_API_KEY` | Yes | — |
| `SOLANA_RPC_URL` | No | `mainnet-beta` |
| `BAGS_API_BASE` | No | `https://public-api-v2.bags.fm/api/v1` |
| `NOUS_API_KEY` | Agent mode | — |
| `ANTHROPIC_API_KEY` | Agent mode | — |
| `AGENT_WALLET_PUBKEY` | Agent mode | — |

Loaded from `.env` automatically.

---

## Development

```bash
npm run build          # compile
npm run dev            # watch mode
npm run inspect        # MCP Inspector
npm test               # tests
```

---

<p align="center"><sub>MIT License</sub></p>
