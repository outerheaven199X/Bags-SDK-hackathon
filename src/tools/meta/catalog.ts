/** bags_tool_catalog — Lists every available tool grouped by domain, with guidance on custom tool creation. */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface ToolEntry {
  name: string;
  description: string;
}

interface ToolGroup {
  domain: string;
  tools: ToolEntry[];
}

const TOOL_CATALOG: ToolGroup[] = [
  {
    domain: "Trading",
    tools: [
      { name: "bags_quote", description: "Get a swap quote (price, slippage, fees) without executing" },
      { name: "bags_swap", description: "Execute a token swap on Bags.fm" },
    ],
  },
  {
    domain: "Token Launch",
    tools: [
      { name: "bags_launch_feed", description: "Browse recently launched tokens" },
      { name: "bags_create_token_info", description: "Step 1: Create token metadata + upload image to IPFS" },
      { name: "bags_create_fee_config", description: "Step 2: Create on-chain fee sharing config" },
      { name: "bags_create_launch_tx", description: "Step 3: Build the unsigned launch transaction" },
      { name: "bags_launch_token", description: "All-in-one: metadata + fee config + launch tx in a single call" },
    ],
  },
  {
    domain: "Fee Management",
    tools: [
      { name: "bags_resolve_wallet", description: "Look up fee share config for a wallet + token" },
      { name: "bags_resolve_wallets_bulk", description: "Bulk resolve fee configs for multiple wallets" },
      { name: "bags_compose_fee_config", description: "Preview a fee split before committing on-chain" },
      { name: "bags_fee_admin_list", description: "List all configs where a wallet is admin" },
      { name: "bags_fee_admin_transfer", description: "Transfer admin rights to a new wallet" },
      { name: "bags_fee_admin_update", description: "Update claimers or BPS splits on an existing config" },
      { name: "bags_claim_events", description: "View historical claim events for a token" },
    ],
  },
  {
    domain: "Claiming",
    tools: [
      { name: "bags_claimable_positions", description: "List all positions with unclaimed fees" },
      { name: "bags_claim_fees", description: "Claim fees for a single token" },
      { name: "bags_claim_all_fees", description: "Claim all unclaimed fees across every position" },
    ],
  },
  {
    domain: "Partner",
    tools: [
      { name: "bags_partner_stats", description: "View partner earnings and referral stats" },
      { name: "bags_partner_claim", description: "Claim partner referral earnings" },
      { name: "bags_partner_config", description: "Set up or update partner configuration" },
    ],
  },
  {
    domain: "Dexscreener",
    tools: [
      { name: "bags_dexscreener_check", description: "Check if a token is eligible for Dexscreener listing" },
      { name: "bags_dexscreener_order", description: "Create a Dexscreener listing order" },
      { name: "bags_dexscreener_payment", description: "Process payment for a Dexscreener listing" },
    ],
  },
  {
    domain: "Agent Auth",
    tools: [
      { name: "bags_agent_auth_init", description: "Initialize agent authentication flow" },
      { name: "bags_agent_auth_login", description: "Complete agent login with signed message" },
      { name: "bags_agent_wallet_list", description: "List agent-managed wallets" },
      { name: "bags_agent_wallet_export", description: "Export an agent wallet keypair" },
      { name: "bags_agent_keys_list", description: "List API keys for the agent" },
      { name: "bags_agent_keys_create", description: "Create a new API key" },
      { name: "bags_agent_bootstrap", description: "Full agent setup: auth + wallet + key in one call" },
    ],
  },
  {
    domain: "On-Chain State",
    tools: [
      { name: "bags_pools", description: "List active liquidity pools" },
      { name: "bags_pool", description: "Get details for a specific pool by token mint" },
      { name: "bags_pool_config_keys", description: "Look up Meteora config keys for a pool" },
    ],
  },
  {
    domain: "Analytics",
    tools: [
      { name: "bags_token_creators", description: "Find tokens created by a wallet" },
      { name: "bags_lifetime_fees", description: "View total lifetime fees earned by a wallet" },
      { name: "bags_claim_stats", description: "Detailed claim statistics for a wallet or token" },
      { name: "bags_top_tokens", description: "Leaderboard of top tokens by volume or fees" },
    ],
  },
  {
    domain: "Solana Utilities",
    tools: [
      { name: "bags_send_transaction", description: "Broadcast a signed transaction to the network" },
      { name: "bags_wallet_balance", description: "Check SOL and token balances for a wallet" },
      { name: "bags_token_holdings", description: "List all token holdings for a wallet" },
    ],
  },
];

const CUSTOM_TOOL_GUIDANCE = [
  "Need something not listed above? I can write a new MCP tool for you.",
  "",
  "The Bags SDK exposes these services you can build on:",
  "  - sdk.tokenLaunch  (create metadata, build launch txs)",
  "  - sdk.config       (fee share configs, lookup tables)",
  "  - sdk.fee          (claim fees, resolve positions)",
  "  - sdk.trade        (quotes, swaps)",
  "  - sdk.state        (pools, on-chain account reads)",
  "  - sdk.partner      (referral configs, claims)",
  "  - sdk.dexscreener  (listing orders, payments)",
  "  - sdk.solana       (send tx, balances, holdings)",
  "  - sdk.feeShareAdmin (admin operations)",
  "",
  "Plus the REST API at https://public-api-v2.bags.fm/api/v1 for any endpoint.",
  "",
  "Just describe what you need and I'll scaffold a new tool that plugs right",
  "into this MCP server — complete with input validation, error handling,",
  "and registration in the tool catalog.",
].join("\n");

/**
 * Register the bags_tool_catalog discovery tool on the given MCP server.
 * @param server - The McpServer instance to register on.
 */
export function registerToolCatalog(server: McpServer) {
  server.tool(
    "bags_tool_catalog",
    "List every available Bags SDK tool grouped by domain. Returns a structured catalog with descriptions and guidance on creating custom tools. Use this to discover what's possible or when a user asks 'what can you do?'",
    {},
    async () => {
      const totalTools = TOOL_CATALOG.reduce((sum, g) => sum + g.tools.length, 0);

      const output = {
        totalTools,
        domains: TOOL_CATALOG.length,
        catalog: TOOL_CATALOG,
        customTools: CUSTOM_TOOL_GUIDANCE,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
      };
    },
  );
}
