/** Local signing server — serves a wallet-connect page for transaction signing. */

import express from "express";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SIGNING_PORT = 3141;
const SESSION_TTL_MS = 600_000; /* 10 minutes */

interface SigningSession {
  id: string;
  transactions: string[];
  description: string;
  meta: Record<string, string>;
  rpcUrl: string;
  signatures: string[];
  complete: boolean;
  createdAt: number;
}

const sessions = new Map<string, SigningSession>();
let serverRunning = false;

/**
 * Remove expired sessions older than SESSION_TTL_MS.
 */
function pruneExpired(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

/**
 * Start the signing server (idempotent — only starts once).
 * Binds to 127.0.0.1 only for security.
 */
export function startSigningServer(): void {
  if (serverRunning) return;
  serverRunning = true;

  const thisDir = dirname(fileURLToPath(import.meta.url));
  const pagePath = resolve(thisDir, "page.html");
  const pageHtml = readFileSync(pagePath, "utf-8");

  const app = express();
  app.use(express.json());

  app.get("/sign/:sessionId", (_req, res) => {
    res.type("html").send(pageHtml);
  });

  app.get("/api/sign/:sessionId", (req, res) => {
    pruneExpired();
    const session = sessions.get(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: "Session not found or expired." });
      return;
    }
    res.json({
      transactions: session.transactions,
      description: session.description,
      meta: session.meta,
      rpcUrl: session.rpcUrl,
    });
  });

  app.post("/api/sign/:sessionId/complete", (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    session.signatures = req.body.signatures || [];
    session.complete = true;
    res.json({ ok: true });
  });

  app.listen(SIGNING_PORT, "127.0.0.1", () => {
    console.error(`[bags-sdk-mcp] Signing server at http://localhost:${SIGNING_PORT}`);
  });
}

/**
 * Create a new signing session and return its URL.
 * @param transactions - Base58-encoded unsigned transactions.
 * @param description - What the user is signing (shown on the page).
 * @param meta - Key-value pairs displayed as token details.
 * @returns The localhost URL for the signing page.
 */
export function createSigningSession(
  transactions: string[],
  description: string,
  meta: Record<string, string>,
): string {
  startSigningServer();
  pruneExpired();

  const id = randomUUID();
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

  sessions.set(id, {
    id,
    transactions,
    description,
    meta,
    rpcUrl,
    signatures: [],
    complete: false,
    createdAt: Date.now(),
  });

  return `http://localhost:${SIGNING_PORT}/sign/${id}`;
}

/**
 * Check whether a signing session has been completed.
 * @param sessionId - The session UUID.
 * @returns The session if complete, null otherwise.
 */
export function getSessionStatus(sessionId: string): SigningSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  return session.complete ? session : null;
}
