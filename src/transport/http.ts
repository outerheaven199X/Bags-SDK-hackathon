/** Streamable HTTP transport entry point for remote MCP connections. */

import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { createServer } from "../index.js";

const DEFAULT_PORT = 3000;

/**
 * Start the BagsSDK MCP server over streamable HTTP.
 * Exposes POST /mcp for MCP protocol messages.
 * @param port - Port to listen on (default 3000, or PORT env var).
 */
export async function startHttp(port?: number): Promise<void> {
  const listenPort = port ?? (Number(process.env.PORT) || DEFAULT_PORT);

  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);

  const app = express();
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    await transport.handleRequest(req, res, req.body);
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "bags-sdk-mcp" });
  });

  app.listen(listenPort, () => {
    console.error(`[bags-sdk-mcp] HTTP server running on port ${listenPort}`);
    console.error(`[bags-sdk-mcp] MCP endpoint: POST http://localhost:${listenPort}/mcp`);
  });
}
