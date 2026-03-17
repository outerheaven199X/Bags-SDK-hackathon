#!/usr/bin/env node
/** Universal CLI entry point with flag parsing for stdio, HTTP, and agent modes. */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

loadEnvFile(resolve(process.cwd(), ".env"));
loadEnvFile(resolve(__dirname, "..", ".env"));

const args = process.argv.slice(2);

async function main(): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    return;
  }

  validateEnv();

  if (args.includes("--agent")) {
    const { startAgent } = await import("../src/agent/cli.js");
    await startAgent({
      strategies: args.includes("--auto-claim") ? ["auto-claim"] : [],
      monitor: args.includes("--monitor"),
    });
    return;
  }

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
bags-sdk-mcp — Batteries-included MCP server for Bags.fm

USAGE:
  bags-sdk-mcp              Start stdio MCP server (default, for Claude Desktop)
  bags-sdk-mcp --http       Start streamable HTTP MCP server
  bags-sdk-mcp --http --port=8080   HTTP on custom port
  bags-sdk-mcp --agent      Start autonomous agent mode
  bags-sdk-mcp --agent --auto-claim   Agent with auto-claim strategy
  bags-sdk-mcp --agent --monitor      Agent with launch monitor

OPTIONS:
  --http          Use streamable HTTP transport instead of stdio
  --port=PORT     HTTP port (default 3000)
  --agent         Run in autonomous agent mode
  --auto-claim    Enable auto-claim strategy (agent mode)
  --monitor       Enable launch monitor strategy (agent mode)
  -h, --help      Show this help message

ENVIRONMENT:
  BAGS_API_KEY        Required. Get one at dev.bags.fm
  SOLANA_RPC_URL      Optional. Default: mainnet-beta
  NOUS_API_KEY        Agent mode: Hermes 4 for fast decisions
  ANTHROPIC_API_KEY   Agent mode: Sonnet for strategic decisions
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
      "    1. Create a .env file with BAGS_API_KEY=your-key\n" +
      "    2. Pass it via your MCP client config env block\n" +
      "    3. Export it: export BAGS_API_KEY=your-key\n" +
      "\n" +
      "  Get a key at https://dev.bags.fm\n",
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[bags-sdk-mcp] Fatal error:", error);
  process.exit(1);
});
