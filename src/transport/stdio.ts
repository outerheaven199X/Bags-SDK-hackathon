#!/usr/bin/env node
/** Stdio transport entry point for MCP Inspector and Claude Desktop. */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createServer } from "../index.js";

/**
 * Start the BagsSDK MCP server over stdio.
 * This is the default transport for Claude Desktop integration.
 */
export async function startStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[bags-sdk-mcp] Server running on stdio");
}
