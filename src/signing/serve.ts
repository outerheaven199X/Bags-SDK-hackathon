/** Local signing server — serves wallet-connect pages for transaction signing and token launches. */

import express from "express";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { buildFeeConfigTxs, buildLaunchTx } from "./launch-builder.js";

const SIGNING_PORT = 3141;
const SESSION_TTL_MS = 600_000;
/** Placeholder for claimersArray entries that should be replaced with the connected wallet. */
export const WALLET_PLACEHOLDER = "__CONNECTED_WALLET__";

/** Pre-built signing session — transactions already exist. */
interface SigningSession {
  type: "sign";
  id: string;
  transactions: string[];
  description: string;
  meta: Record<string, string>;
  rpcUrl: string;
  signatures: string[];
  complete: boolean;
  createdAt: number;
}

/** Two-phase launch session — transactions built after wallet connects. */
interface LaunchSession {
  type: "launch";
  id: string;
  tokenMint: string;
  uri: string;
  claimersArray: string[];
  basisPointsArray: number[];
  initialBuyLamports: number;
  description: string;
  meta: Record<string, string>;
  rpcUrl: string;
  phase: "connect" | "fee_config" | "launch" | "complete";
  wallet: string | null;
  meteoraConfigKey: string | null;
  feeConfigTxs: string[];
  launchTx: string | null;
  signatures: string[];
  createdAt: number;
}

/** Scout preview session — image approval before launch. */
interface ScoutSession {
  type: "scout";
  id: string;
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  imagePrompt: string;
  reasoning: string;
  source: string;
  feeConfig: { template: string; recipients: Array<{ provider: string; username: string; bps: number }> };
  tokenMint: string | null;
  uri: string | null;
  claimersArray: string[];
  basisPointsArray: number[];
  initialBuyLamports: number;
  meta: Record<string, string>;
  rpcUrl: string;
  phase: "preview" | "approved" | "complete";
  wallet: string | null;
  meteoraConfigKey: string | null;
  signatures: string[];
  createdAt: number;
}

type Session = SigningSession | LaunchSession | ScoutSession;

const sessions = new Map<string, Session>();
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
 * Resolve the HTML page path relative to this module.
 */
function loadPageHtml(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(thisDir, "page.html"), "utf-8");
}

/**
 * Load the scout preview page HTML.
 */
function loadScoutPageHtml(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(thisDir, "scout-page.html"), "utf-8");
}

/**
 * Register all signing/launch/scout API routes on the Express app.
 */
function registerRoutes(app: express.Express, pageHtml: string): void {
  registerSignRoutes(app, pageHtml);
  registerLaunchRoutes(app, pageHtml);
  registerScoutRoutes(app);
}

/**
 * Register routes for pre-built signing sessions (/sign/:id).
 */
function registerSignRoutes(app: express.Express, pageHtml: string): void {
  app.get("/sign/:sessionId", (_req, res) => {
    res.type("html").send(pageHtml);
  });

  app.get("/api/sign/:sessionId", (req, res) => {
    pruneExpired();
    const session = sessions.get(req.params.sessionId);
    if (!session || session.type !== "sign") {
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
    if (!session || session.type !== "sign") {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    session.signatures = req.body.signatures || [];
    session.complete = true;
    res.json({ ok: true });
  });
}

/**
 * Skip the fee config signing and go straight to building the launch transaction.
 * Used when the fee config already exists on-chain (zero transactions returned).
 */
async function skipToLaunchPhase(session: LaunchSession, res: express.Response): Promise<void> {
  try {
    const result = await buildLaunchTx(
      session.wallet!, session.uri, session.tokenMint,
      session.meteoraConfigKey!, session.initialBuyLamports,
    );
    session.launchTx = result.transaction;
    session.phase = "launch";

    const solAmount = session.initialBuyLamports / 1_000_000_000;
    res.json({
      phase: "launch",
      transactions: [result.transaction],
      description: `Fee config exists — launch ${session.meta.Symbol || "token"} (initial buy: ${solAmount} SOL)`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
}

/**
 * Register routes for two-phase launch sessions (/launch/:id).
 */
function registerLaunchRoutes(app: express.Express, pageHtml: string): void {
  app.get("/launch/:sessionId", (_req, res) => {
    res.type("html").send(pageHtml);
  });

  app.get("/api/launch/:sessionId", (req, res) => {
    pruneExpired();
    const session = sessions.get(req.params.sessionId);
    if (!session || session.type !== "launch") {
      res.status(404).json({ error: "Session not found or expired." });
      return;
    }
    res.json({
      description: session.description,
      meta: session.meta,
      rpcUrl: session.rpcUrl,
      phase: session.phase,
    });
  });

  app.post("/api/launch/:sessionId/connect", async (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session || session.type !== "launch") {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    if (session.phase !== "connect") {
      res.status(400).json({ error: `Expected phase 'connect', got '${session.phase}'.` });
      return;
    }

    const { wallet } = req.body;
    if (!wallet || typeof wallet !== "string") {
      res.status(400).json({ error: "Missing wallet address." });
      return;
    }

    try {
      const claimers = session.claimersArray.map((c) => c === WALLET_PLACEHOLDER ? wallet : c);
      const result = await buildFeeConfigTxs(
        wallet, session.tokenMint, claimers, session.basisPointsArray,
      );
      session.wallet = wallet;
      session.meteoraConfigKey = result.meteoraConfigKey;
      session.feeConfigTxs = result.transactions;

      if (result.transactions.length === 0) {
        session.phase = "fee_config";
        await skipToLaunchPhase(session, res);
        return;
      }

      session.phase = "fee_config";
      res.json({
        phase: "fee_config",
        transactions: result.transactions,
        description: `Fee setup for ${session.meta.Symbol || session.tokenMint}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/launch/:sessionId/fee-signed", async (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session || session.type !== "launch") {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    if (session.phase !== "fee_config") {
      res.status(400).json({ error: `Expected phase 'fee_config', got '${session.phase}'.` });
      return;
    }

    session.signatures.push(...(req.body.signatures || []));

    try {
      const result = await buildLaunchTx(
        session.wallet!, session.uri, session.tokenMint,
        session.meteoraConfigKey!, session.initialBuyLamports,
      );
      session.launchTx = result.transaction;
      session.phase = "launch";

      const solAmount = session.initialBuyLamports / 1_000_000_000;
      res.json({
        phase: "launch",
        transactions: [result.transaction],
        description: `Launch ${session.meta.Symbol || "token"} (initial buy: ${solAmount} SOL)`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/launch/:sessionId/complete", (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session || session.type !== "launch") {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    session.signatures.push(...(req.body.signatures || []));
    session.phase = "complete";
    res.json({ ok: true });
  });
}

/**
 * Register routes for scout preview sessions (/scout/:id).
 * Image approval flow: preview → regenerate → approve → wallet → sign → complete.
 */
function registerScoutRoutes(app: express.Express): void {
  const scoutHtml = loadScoutPageHtml();

  app.get("/scout/:sessionId", (_req, res) => {
    res.type("html").send(scoutHtml);
  });

  app.get("/api/scout/:sessionId", (req, res) => {
    pruneExpired();
    const session = sessions.get(req.params.sessionId);
    if (!session || session.type !== "scout") {
      res.status(404).json({ error: "Session not found or expired." });
      return;
    }
    res.json({
      name: session.name,
      symbol: session.symbol,
      description: session.description,
      imageUrl: session.imageUrl,
      imagePrompt: session.imagePrompt,
      reasoning: session.reasoning,
      source: session.source,
      meta: session.meta,
      rpcUrl: session.rpcUrl,
      phase: session.phase,
    });
  });

  app.post("/api/scout/:sessionId/regenerate", async (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session || session.type !== "scout") {
      res.status(404).json({ error: "Session not found." });
      return;
    }

    const feedback = req.body.feedback || "";
    const updatedPrompt = feedback
      ? `${session.imagePrompt}. User feedback: ${feedback}`
      : session.imagePrompt;

    try {
      const { generateTokenImage, resolveImageConfig } = await import("../agent/strategies/imagegen.js");
      const config = resolveImageConfig();
      if (!config) {
        res.status(400).json({ error: "No image generation API key configured." });
        return;
      }
      const result = await generateTokenImage(updatedPrompt, config);
      if (!result?.url) {
        res.status(500).json({ error: "Image generation returned no result." });
        return;
      }
      session.imageUrl = result.url;
      session.imagePrompt = updatedPrompt;
      res.json({ imageUrl: result.url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/scout/:sessionId/approve", async (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session || session.type !== "scout") {
      res.status(404).json({ error: "Session not found." });
      return;
    }

    const { wallet } = req.body;
    if (!wallet || typeof wallet !== "string") {
      res.status(400).json({ error: "Missing wallet address." });
      return;
    }

    try {
      session.wallet = wallet;
      session.phase = "approved";

      const { getBagsSDK } = await import("../client/bags-sdk-wrapper.js");
      const sdk = getBagsSDK();

      const tokenInfo = await sdk.tokenLaunch.createTokenInfoAndMetadata({
        name: session.name,
        symbol: session.symbol,
        description: session.description,
        imageUrl: session.imageUrl,
      });

      session.tokenMint = tokenInfo.tokenMint;
      session.uri = tokenInfo.tokenLaunch?.uri ?? tokenInfo.tokenMetadata;

      const claimers = session.claimersArray.map((c) => c === WALLET_PLACEHOLDER ? wallet : c);
      const feeResult = await buildFeeConfigTxs(
        wallet, session.tokenMint!, claimers, session.basisPointsArray,
      );
      session.meteoraConfigKey = feeResult.meteoraConfigKey;

      if (feeResult.transactions.length === 0) {
        const launchResult = await buildLaunchTx(
          wallet, session.uri!, session.tokenMint!,
          session.meteoraConfigKey!, session.initialBuyLamports,
        );
        res.json({
          transactions: [launchResult.transaction],
          description: `Launch ${session.symbol} (fee config exists)`,
        });
        return;
      }

      const launchResult = await buildLaunchTx(
        wallet, session.uri!, session.tokenMint!,
        session.meteoraConfigKey!, session.initialBuyLamports,
      );

      const allTxs = [...feeResult.transactions, launchResult.transaction];
      res.json({
        transactions: allTxs,
        description: `Sign ${allTxs.length} transactions to launch ${session.symbol}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/scout/:sessionId/complete", (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session || session.type !== "scout") {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    session.signatures.push(...(req.body.signatures || []));
    session.phase = "complete";
    res.json({ ok: true });
  });
}

/**
 * Start the signing server (idempotent — only starts once).
 * Binds to 127.0.0.1 only for security.
 */
export function startSigningServer(): void {
  if (serverRunning) return;
  serverRunning = true;

  const pageHtml = loadPageHtml();
  const app = express();
  app.use(express.json());
  registerRoutes(app, pageHtml);

  app.listen(SIGNING_PORT, "127.0.0.1", () => {
    console.error(`[bags-sdk-mcp] Signing server at http://localhost:${SIGNING_PORT}`);
  });
}

/**
 * Create a new pre-built signing session and return its URL.
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
    type: "sign",
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

/** Parameters for creating a two-phase launch session. */
export interface LaunchSessionParams {
  tokenMint: string;
  uri: string;
  claimersArray: string[];
  basisPointsArray: number[];
  initialBuyLamports: number;
  description: string;
  meta: Record<string, string>;
}

/**
 * Create a two-phase launch session — wallet comes from the page, not from chat.
 * @param params - Token details and fee split info.
 * @returns The localhost URL for the launch page.
 */
export function createLaunchSession(params: LaunchSessionParams): string {
  startSigningServer();
  pruneExpired();

  const id = randomUUID();
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

  sessions.set(id, {
    type: "launch",
    id,
    tokenMint: params.tokenMint,
    uri: params.uri,
    claimersArray: params.claimersArray,
    basisPointsArray: params.basisPointsArray,
    initialBuyLamports: params.initialBuyLamports,
    description: params.description,
    meta: params.meta,
    rpcUrl,
    phase: "connect",
    wallet: null,
    meteoraConfigKey: null,
    feeConfigTxs: [],
    launchTx: null,
    signatures: [],
    createdAt: Date.now(),
  });

  return `http://localhost:${SIGNING_PORT}/launch/${id}`;
}

/** Parameters for creating a scout preview session. */
export interface ScoutSessionParams {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  imagePrompt: string;
  reasoning: string;
  source: string;
  claimersArray: string[];
  basisPointsArray: number[];
  initialBuyLamports: number;
  meta: Record<string, string>;
}

/**
 * Create a scout preview session — shows image for approval before launch.
 * @param params - Token package details and fee config.
 * @returns The localhost URL for the scout preview page.
 */
export function createScoutSession(params: ScoutSessionParams): string {
  startSigningServer();
  pruneExpired();

  const id = randomUUID();
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

  sessions.set(id, {
    type: "scout",
    id,
    name: params.name,
    symbol: params.symbol,
    description: params.description,
    imageUrl: params.imageUrl,
    imagePrompt: params.imagePrompt,
    reasoning: params.reasoning,
    source: params.source,
    feeConfig: { template: "solo", recipients: [] },
    tokenMint: null,
    uri: null,
    claimersArray: params.claimersArray,
    basisPointsArray: params.basisPointsArray,
    initialBuyLamports: params.initialBuyLamports,
    meta: params.meta,
    rpcUrl,
    phase: "preview",
    wallet: null,
    meteoraConfigKey: null,
    signatures: [],
    createdAt: Date.now(),
  });

  return `http://localhost:${SIGNING_PORT}/scout/${id}`;
}

/**
 * Check whether a signing session has been completed.
 * @param sessionId - The session UUID.
 * @returns The session if complete, null otherwise.
 */
export function getSessionStatus(sessionId: string): Session | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (session.type === "sign") return session.complete ? session : null;
  return session.phase === "complete" ? session : null;
}
