<h1 align="center">Bags SDK — MCP Server</h1>

<p align="center">
  Launch a coin in 3 steps from your terminal.<br/>
  46 MCP tools. Fee splits, claims, Dexscreener, agent auth, scout mode.<br/>
  Your AI handles the rest.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/bags-sdk-mcp"><img src="https://img.shields.io/npm/v/bags-sdk-mcp?style=flat-square&color=00ff41" alt="npm" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-00ff41?style=flat-square" alt="MIT" /></a>
  <a href="https://dev.bags.fm"><img src="https://img.shields.io/badge/API_Key-dev.bags.fm-00ff41?style=flat-square" alt="API Key" /></a>
</p>

---

## Install (one command)

```bash
npx bags-sdk-mcp --setup
```

Get your API key at [dev.bags.fm](https://dev.bags.fm). The wizard detects your MCP clients, asks for your key, and writes the config. Restart your client and you're live.

<details>
<summary>Claude Code alternative</summary>

```bash
claude mcp add bags-sdk-mcp -e BAGS_API_KEY=your-key -- npx bags-sdk-mcp
```

</details>

<details>
<summary>Manual install</summary>

Add this to your MCP config file:

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

| Client | Config path |
|--------|-------------|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%/Claude/claude_desktop_config.json` |
| Cursor | `.cursor/mcp.json` in project root |
| Claude Code | `.mcp.json` in project root |

Restart your client after saving.

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

---

## What Is This

**bags-sdk-mcp** is an MCP server that exposes the entire [Bags.fm](https://bags.fm) API as 46 tools, 4 resources, and 8 prompts. Any MCP-compatible AI client — Claude Desktop, Claude Code, Cursor, or custom agents — can interact with the Bags.fm ecosystem through natural language.

No private keys pass through this server. Every tool returns unsigned transaction data. The signing page runs on localhost and connects directly to your browser wallet.

---

## Launch a Coin

```
You:    "Launch a coin called bori, symbol BOOL, 0.001 SOL initial buy"
Agent:  shows summary, asks for confirmation
You:    "Go"
Agent:  opens signing page → connect wallet → sign twice → live
```

Connect Phantom, Solflare, Backpack, or Coinbase, approve two transactions, and your coin is on-chain.

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
| "Scan for trending token ideas" | Scout mode + AI-generated launch packages |

---

## 46 Tools

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
| **Scout** | `scout_scan` `scout_launch` `generate_token_image` |
| **Meta** | `tool_catalog` |

All prefixed with `bags_`.

---

## Agent Mode

```bash
bags-sdk-mcp --agent --auto-claim      # claim fees every 5 min
bags-sdk-mcp --agent --monitor         # watch launches, flag interesting ones
bags-sdk-mcp --agent --scout           # scan trends, propose token launches
bags-sdk-mcp --agent --scout --auto-claim --monitor   # all strategies
```

Requires `NOUS_API_KEY` and `ANTHROPIC_API_KEY`.

---

## CLI Reference

```
SETUP
  bags-sdk-mcp --setup               Interactive installer for Claude Desktop, Cursor, etc.
  bags-sdk-mcp --uninstall            Remove from all detected MCP client configs

SERVER
  bags-sdk-mcp                        Start stdio server (default, for MCP clients)
  bags-sdk-mcp --http                 Start HTTP server on port 3000
  bags-sdk-mcp --http --port=8080     HTTP on custom port

AGENT
  bags-sdk-mcp --agent --auto-claim   Claim fees above threshold every 5 min
  bags-sdk-mcp --agent --monitor      Watch launches, flag interesting ones
  bags-sdk-mcp --agent --scout        Scan trends, propose token launches

TOOLS
  bags-sdk-mcp --fee-optimize         Analyze fee configs, suggest improvements
  bags-sdk-mcp --rebalance            Analyze positions, recommend claim strategy

DIAGNOSTICS
  bags-sdk-mcp --doctor               Check everything: env, API, RPC, configs, ports
  bags-sdk-mcp --info                 Show current config and capabilities (no network)
  bags-sdk-mcp --whoami               Test API key and show wallet stats
  bags-sdk-mcp --test-key             Validate API key only
  bags-sdk-mcp --version, -v          Print version
  bags-sdk-mcp --clear-sessions       Wipe expired signing sessions
```

---

## Troubleshooting

### Something isn't working

```bash
npx bags-sdk-mcp --doctor
```

Doctor checks your env vars, API key, RPC connectivity, MCP client configs, signing port, and sessions. It tells you exactly what's wrong and how to fix it.

### Quick checks

```bash
npx bags-sdk-mcp --test-key           # is my API key valid?
npx bags-sdk-mcp --info               # what does my config look like?
npx bags-sdk-mcp --whoami             # what does the server see?
```

### Common issues

| Problem | Fix |
|---------|-----|
| `BAGS_API_KEY is missing` | Run `npx bags-sdk-mcp --setup` or set the key in your MCP config |
| Key validation fails | Get a new key at [dev.bags.fm](https://dev.bags.fm), then `npx bags-sdk-mcp --test-key` |
| Signing page won't load | Port 3141 may be in use — `npx bags-sdk-mcp --doctor` will check |
| Stale signing sessions | Run `npx bags-sdk-mcp --clear-sessions` |
| Agent mode crashes | Check `NOUS_API_KEY` and `ANTHROPIC_API_KEY` are set — `--doctor` flags these |

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
| `IMAGE_GEN_PROVIDER` | Scout mode | `fal` |
| `FAL_API_KEY` | Scout mode | — |
| `REPLICATE_API_KEY` | Scout mode | — |
| `SCOUT_INTERVAL` | Scout mode | `1800` |
| `SCOUT_SOURCES` | Scout mode | `bags,news` |
| `SCOUT_MAX_IDEAS` | Scout mode | `3` |

Loaded from `.env` automatically.

---

## Known Issues

### npm audit vulnerabilities

Running `npm audit` reports vulnerabilities in transitive dependencies from `@meteora-ag/cp-amm-sdk` (Meteora's AMM SDK), which incorrectly ships test frameworks (`mocha`, `chai`) as production dependencies. These packages are never imported or executed by bags-sdk-mcp. We've reported this upstream.

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
