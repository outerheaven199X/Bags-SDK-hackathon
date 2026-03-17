#!/usr/bin/env node
/** Universal CLI entry point with flag parsing for stdio, HTTP, and agent modes. */

const args = process.argv.slice(2);

async function main(): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    return;
  }

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

main().catch((error) => {
  console.error("[bags-sdk-mcp] Fatal error:", error);
  process.exit(1);
});
