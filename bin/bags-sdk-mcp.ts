#!/usr/bin/env node
/** Universal CLI entry point — flag dispatch, env loading, server startup. */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

loadEnvFile(resolve(process.cwd(), ".env"));
loadEnvFile(resolve(__dirname, "..", ".env"));

const args = process.argv.slice(2);

async function main(): Promise<void> {
  // 1. Flags that never need env validation
  if (args.includes("--help") || args.includes("-h")) { printUsage(); return; }
  if (args.includes("--version") || args.includes("-v")) {
    const { printVersion } = await import("../src/cli/version.js");
    printVersion();
    return;
  }

  // 2. Flags that handle their own env checking (no BAGS_API_KEY required)
  if (args.includes("--setup")) {
    const { runSetupWizard } = await import("../src/setup/wizard.js");
    await runSetupWizard();
    return;
  }
  if (args.includes("--uninstall")) {
    const { runUninstallWizard } = await import("../src/setup/wizard.js");
    await runUninstallWizard();
    return;
  }
  if (args.includes("--clear-sessions")) {
    const { clearSessions } = await import("../src/cli/sessions.js");
    clearSessions();
    return;
  }
  if (args.includes("--info")) {
    const { printInfo } = await import("../src/cli/info.js");
    printInfo();
    return;
  }
  if (args.includes("--doctor")) {
    const { runDoctor } = await import("../src/cli/doctor.js");
    process.exit(await runDoctor());
  }

  // 3. Flags that need a valid BAGS_API_KEY
  validateEnv();

  if (args.includes("--test-key")) {
    const { runTestKey } = await import("../src/cli/whoami.js");
    await runTestKey();
    return;
  }
  if (args.includes("--whoami")) {
    const { runWhoami } = await import("../src/cli/whoami.js");
    await runWhoami();
    return;
  }

  // 4. Agent mode
  if (args.includes("--agent") || args.includes("--fee-optimize") || args.includes("--rebalance")) {
    const { startAgent } = await import("../src/agent/cli.js");
    const strategies: string[] = [];
    if (args.includes("--auto-claim")) strategies.push("auto-claim");
    if (args.includes("--monitor")) strategies.push("monitor");
    if (args.includes("--scout")) strategies.push("scout");
    if (args.includes("--fee-optimize")) strategies.push("fee-optimize");
    if (args.includes("--rebalance")) strategies.push("rebalance");
    await startAgent({ strategies });
    return;
  }

  // 5. Server modes
  if (args.includes("--http")) {
    const { startHttp } = await import("../src/transport/http.js");
    const portFlag = args.find((a) => a.startsWith("--port="));
    const port = portFlag ? Number(portFlag.split("=")[1]) : undefined;
    await startHttp(port);
    return;
  }

  const { startStdio } = await import("../src/transport/stdio.js");
  await startStdio();
}

function printUsage(): void {
  console.log(`
bags-sdk-mcp — MCP server for Bags.fm (46 tools)

SETUP
  bags-sdk-mcp --setup               Interactive installer for Claude Desktop, Cursor, etc.
  bags-sdk-mcp --uninstall            Remove from all detected MCP client configs

  Claude Code:  claude mcp add bags-sdk-mcp -e BAGS_API_KEY=xxx -- npx bags-sdk-mcp

SERVER
  bags-sdk-mcp                        Start stdio server (default, for MCP clients)
  bags-sdk-mcp --http                 Start HTTP server on port 3000
  bags-sdk-mcp --http --port=8080     HTTP on custom port

AGENT
  bags-sdk-mcp --agent --auto-claim   Claim fees above threshold every 5 min
  bags-sdk-mcp --agent --monitor      Watch launches, flag interesting ones
  bags-sdk-mcp --agent --scout        Scan trends, propose token launches
  bags-sdk-mcp --agent --scout --auto-claim --monitor   All strategies

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

ENVIRONMENT
  BAGS_API_KEY        Required. Get one at dev.bags.fm
  SOLANA_RPC_URL      Optional. Default: mainnet-beta
  NOUS_API_KEY        Agent mode: Hermes for fast decisions
  ANTHROPIC_API_KEY   Agent mode: Sonnet for strategy
  AGENT_WALLET_PUBKEY Agent mode: wallet to operate on
  FAL_API_KEY         Scout mode: fal.ai image generation
  REPLICATE_API_KEY   Scout mode: Replicate image generation
`.trim());
}

/**
 * Load key=value pairs from a .env file into process.env (skip existing keys).
 * @param filePath - Absolute path to the .env file.
 */
function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

/**
 * Validate required environment before starting any transport.
 * Exits with a clear message instead of failing on first tool call.
 */
function validateEnv(): void {
  if (!process.env.BAGS_API_KEY) {
    console.error(
      "[bags-sdk-mcp] BAGS_API_KEY is missing.\n" +
      "\n" +
      "  Set it in one of these ways:\n" +
      "    1. Run: npx bags-sdk-mcp --setup\n" +
      "    2. Create a .env file with BAGS_API_KEY=your-key\n" +
      "    3. Pass it via your MCP client config env block\n" +
      "    4. Export it: export BAGS_API_KEY=your-key\n" +
      "\n" +
      "  Get a key at https://dev.bags.fm\n" +
      "  Diagnose issues: npx bags-sdk-mcp --doctor\n",
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[bags-sdk-mcp] Fatal error:", error);
  process.exit(1);
});
