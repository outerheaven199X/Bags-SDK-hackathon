/** Local signing server — serves wallet-connect pages for transaction signing and token launches. */

import express from "express";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { buildFeeConfigTxs, buildLaunchTx } from "./launch-builder.js";
import { getSession, setSession } from "./session-store.js";

const SIGNING_PORT = 3141;
/** Placeholder for claimersArray entries that should be replaced with the connected wallet. */
export const WALLET_PLACEHOLDER = "__CONNECTED_WALLET__";

/** Allowed Origin values — only the local signing server itself. */
const ALLOWED_ORIGIN = `http://localhost:${SIGNING_PORT}`;

/** Pre-built signing session — transactions already exist. */
interface SigningSession {
  type: "sign";
  id: string;
  csrfToken: string;
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
  csrfToken: string;
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
  csrfToken: string;
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
  phase: "preview" | "approved" | "fee_config" | "launch" | "complete";
  wallet: string | null;
  meteoraConfigKey: string | null;
  signatures: string[];
  createdAt: number;
}

type Session = SigningSession | LaunchSession | ScoutSession;

let serverRunning = false;

/** Generate a cryptographically strong session ID (32 bytes hex = 64 chars). */
function generateSessionId(): string {
  return randomBytes(32).toString("hex");
}

/** Generate a CSRF token for a session. */
function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
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
 * Wrap an async route handler so Express 4 catches rejected promises.
 * @param fn - Async request handler.
 * @returns Wrapped handler that forwards errors to Express error middleware.
 */
function asyncHandler(
  fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>,
): express.RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validate the Origin header on POST requests to prevent CSRF.
 * Rejects requests from foreign origins (e.g. malicious pages posting to localhost).
 */
function validateOrigin(req: express.Request, res: express.Response): boolean {
  const origin = req.headers.origin;
  if (origin && origin !== ALLOWED_ORIGIN) {
    res.status(403).json({ error: "Forbidden: origin not allowed." });
    return false;
  }
  return true;
}

/**
 * Validate the CSRF token on a POST request against the session's stored token.
 * @param req - Express request (expects body.csrfToken).
 * @param session - The session containing the expected token.
 * @param res - Express response (sends 403 on mismatch).
 * @returns True if valid, false if response was already sent.
 */
function validateCsrf(req: express.Request, session: Session, res: express.Response): boolean {
  const token = req.body?.csrfToken;
  if (!token || token !== session.csrfToken) {
    res.status(403).json({ error: "Invalid or missing CSRF token." });
    return false;
  }
  return true;
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

  app.get("/api/sign/:sessionId", asyncHandler(async (req, res) => {
    const session = await getSession<SigningSession>(req.params.sessionId);
    if (!session || session.type !== "sign") {
      res.status(404).json({ error: "Session not found or expired." });
      return;
    }
    res.json({
      transactions: session.transactions,
      description: session.description,
      meta: session.meta,
      rpcUrl: session.rpcUrl,
      csrfToken: session.csrfToken,
    });
  }));

  app.post("/api/sign/:sessionId/complete", asyncHandler(async (req, res) => {
    if (!validateOrigin(req, res)) return;
    const session = await getSession<SigningSession>(req.params.sessionId);
    if (!session || session.type !== "sign") {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    if (!validateCsrf(req, session, res)) return;
    session.signatures = req.body.signatures || [];
    session.complete = true;
    await setSession(req.params.sessionId, session);
    res.json({ ok: true });
  }));
}

/**
 * Skip the fee config signing and go straight to building the launch transaction.
 * Used when the fee config already exists on-chain (zero transactions returned).
 */
async function skipToLaunchPhase(session: LaunchSession, res: express.Response): Promise<void> {
  const result = await buildLaunchTx(
    session.wallet!, session.uri, session.tokenMint,
    session.meteoraConfigKey!, session.initialBuyLamports,
  );
  session.launchTx = result.transaction;
  session.phase = "launch";
  await setSession(session.id, session);

  const solAmount = session.initialBuyLamports / 1_000_000_000;
  res.json({
    phase: "launch",
    transactions: [result.transaction],
    description: `Fee config exists — launch ${session.meta.Symbol || "token"} (initial buy: ${solAmount} SOL)`,
  });
}

/**
 * Register routes for two-phase launch sessions (/launch/:id).
 */
function registerLaunchRoutes(app: express.Express, pageHtml: string): void {
  app.get("/launch/:sessionId", (_req, res) => {
    res.type("html").send(pageHtml);
  });

  app.get("/api/launch/:sessionId", asyncHandler(async (req, res) => {
    const session = await getSession<LaunchSession>(req.params.sessionId);
    if (!session || session.type !== "launch") {
      res.status(404).json({ error: "Session not found or expired." });
      return;
    }
    res.json({
      description: session.description,
      meta: session.meta,
      rpcUrl: session.rpcUrl,
      phase: session.phase,
      csrfToken: session.csrfToken,
    });
  }));

  app.post("/api/launch/:sessionId/connect", asyncHandler(async (req, res) => {
    if (!validateOrigin(req, res)) return;
    const session = await getSession<LaunchSession>(req.params.sessionId);
    if (!session || session.type !== "launch") {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    if (!validateCsrf(req, session, res)) return;
    if (session.phase !== "connect") {
      res.status(400).json({ error: `Expected phase 'connect', got '${session.phase}'.` });
      return;
    }

    const { wallet, initialBuyLamports: buyFromPage } = req.body;
    if (!wallet || typeof wallet !== "string") {
      res.status(400).json({ error: "Missing wallet address." });
      return;
    }

    if (typeof buyFromPage === "number") {
      session.initialBuyLamports = buyFromPage;
    }

    const claimers = session.claimersArray.map((c) => c === WALLET_PLACEHOLDER ? wallet : c);
    const result = await buildFeeConfigTxs(
      wallet, session.tokenMint, claimers, session.basisPointsArray,
    );
    session.wallet = wallet;
    session.meteoraConfigKey = result.meteoraConfigKey;
    session.feeConfigTxs = result.transactions;

    if (result.transactions.length === 0) {
      session.phase = "fee_config";
      await setSession(req.params.sessionId, session);
      await skipToLaunchPhase(session, res);
      return;
    }

    session.phase = "fee_config";
    await setSession(req.params.sessionId, session);
    res.json({
      phase: "fee_config",
      transactions: result.transactions,
      description: `Fee setup for ${session.meta.Symbol || session.tokenMint}`,
    });
  }));

  app.post("/api/launch/:sessionId/fee-signed", asyncHandler(async (req, res) => {
    if (!validateOrigin(req, res)) return;
    const session = await getSession<LaunchSession>(req.params.sessionId);
    if (!session || session.type !== "launch") {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    if (!validateCsrf(req, session, res)) return;
    if (session.phase !== "fee_config") {
      res.status(400).json({ error: `Expected phase 'fee_config', got '${session.phase}'.` });
      return;
    }

    session.signatures.push(...(req.body.signatures || []));

    const result = await buildLaunchTx(
      session.wallet!, session.uri, session.tokenMint,
      session.meteoraConfigKey!, session.initialBuyLamports,
    );
    session.launchTx = result.transaction;
    session.phase = "launch";
    await setSession(req.params.sessionId, session);

    const solAmount = session.initialBuyLamports / 1_000_000_000;
    res.json({
      phase: "launch",
      transactions: [result.transaction],
      description: `Launch ${session.meta.Symbol || "token"} (initial buy: ${solAmount} SOL)`,
    });
  }));

  app.post("/api/launch/:sessionId/complete", asyncHandler(async (req, res) => {
    if (!validateOrigin(req, res)) return;
    const session = await getSession<LaunchSession>(req.params.sessionId);
    if (!session || session.type !== "launch") {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    if (!validateCsrf(req, session, res)) return;
    session.signatures.push(...(req.body.signatures || []));
    session.phase = "complete";
    await setSession(req.params.sessionId, session);
    res.json({ ok: true });
  }));
}

/**
 * Register routes for scout preview sessions (/scout/:id).
 * Image approval flow: preview -> regenerate -> approve -> wallet -> sign -> complete.
 */
function registerScoutRoutes(app: express.Express): void {
  const scoutHtml = loadScoutPageHtml();

  app.get("/scout/:sessionId", (_req, res) => {
    res.type("html").send(scoutHtml);
  });

  app.get("/api/scout/:sessionId", asyncHandler(async (req, res) => {
    const session = await getSession<ScoutSession>(req.params.sessionId);
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
      csrfToken: session.csrfToken,
    });
  }));

  app.post("/api/scout/:sessionId/regenerate", asyncHandler(async (req, res) => {
    if (!validateOrigin(req, res)) return;
    const session = await getSession<ScoutSession>(req.params.sessionId);
    if (!session || session.type !== "scout") {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    if (!validateCsrf(req, session, res)) return;

    const { generateTokenImage, resolveImageConfig } = await import("../agent/strategies/imagegen.js");
    const config = resolveImageConfig();
    if (!config) {
      res.status(400).json({ error: "No image generation API key configured." });
      return;
    }
    const prompt = session.imagePrompt
      || `A bold, iconic token logo for "${session.name}" ($${session.symbol}). ${session.description}. Clean vector style, centered on a solid color background, designed to look great at small sizes.`;
    const result = await generateTokenImage(prompt, config);
    if (!result?.url) {
      res.status(500).json({ error: "Image generation returned no result." });
      return;
    }
    session.imageUrl = result.url;
    await setSession(req.params.sessionId, session);
    res.json({ imageUrl: result.url });
  }));

  app.post("/api/scout/:sessionId/approve", asyncHandler(async (req, res) => {
    if (!validateOrigin(req, res)) return;
    const session = await getSession<ScoutSession>(req.params.sessionId);
    if (!session || session.type !== "scout") {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    if (!validateCsrf(req, session, res)) return;

    const { wallet, initialBuyLamports: buyFromPage } = req.body;
    if (!wallet || typeof wallet !== "string") {
      res.status(400).json({ error: "Missing wallet address." });
      return;
    }

    const buyLamports = typeof buyFromPage === "number" ? buyFromPage : session.initialBuyLamports;

    session.wallet = wallet;
    session.initialBuyLamports = buyLamports;
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
      session.phase = "launch";
      const launchResult = await buildLaunchTx(
        wallet, session.uri!, session.tokenMint!,
        session.meteoraConfigKey!, buyLamports,
      );
      await setSession(req.params.sessionId, session);
      res.json({
        phase: "launch",
        transactions: [launchResult.transaction],
        description: `Launch ${session.symbol}`,
      });
      return;
    }

    session.phase = "fee_config";
    await setSession(req.params.sessionId, session);
    res.json({
      phase: "fee_config",
      transactions: feeResult.transactions,
      description: `Sign ${feeResult.transactions.length} fee setup transaction(s) for ${session.symbol}`,
    });
  }));

  app.post("/api/scout/:sessionId/fee-signed", asyncHandler(async (req, res) => {
    if (!validateOrigin(req, res)) return;
    const session = await getSession<ScoutSession>(req.params.sessionId);
    if (!session || session.type !== "scout") {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    if (!validateCsrf(req, session, res)) return;
    if (session.phase !== "fee_config") {
      res.status(400).json({ error: `Expected phase 'fee_config', got '${session.phase}'.` });
      return;
    }

    session.signatures.push(...(req.body.signatures || []));

    const launchResult = await buildLaunchTx(
      session.wallet!, session.uri!, session.tokenMint!,
      session.meteoraConfigKey!, session.initialBuyLamports,
    );
    session.phase = "launch";
    await setSession(req.params.sessionId, session);
    const solAmount = session.initialBuyLamports / 1_000_000_000;
    res.json({
      phase: "launch",
      transactions: [launchResult.transaction],
      description: `Launch ${session.symbol} (initial buy: ${solAmount} SOL)`,
    });
  }));

  app.post("/api/scout/:sessionId/complete", asyncHandler(async (req, res) => {
    if (!validateOrigin(req, res)) return;
    const session = await getSession<ScoutSession>(req.params.sessionId);
    if (!session || session.type !== "scout") {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    if (!validateCsrf(req, session, res)) return;
    session.signatures.push(...(req.body.signatures || []));
    session.phase = "complete";
    await setSession(req.params.sessionId, session);
    res.json({ ok: true });
  }));
}

/**
 * Express error handler — catches unhandled async errors from route handlers.
 */
function errorHandler(
  err: Error,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
): void {
  console.error("[signing-server] Unhandled error:", err.message);
  res.status(500).json({ error: err.message || "Internal server error" });
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
  app.use(errorHandler);

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
export async function createSigningSession(
  transactions: string[],
  description: string,
  meta: Record<string, string>,
): Promise<string> {
  startSigningServer();

  const id = generateSessionId();
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

  await setSession(id, {
    type: "sign",
    id,
    csrfToken: generateCsrfToken(),
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
export async function createLaunchSession(params: LaunchSessionParams): Promise<string> {
  startSigningServer();

  const id = generateSessionId();
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

  await setSession(id, {
    type: "launch",
    id,
    csrfToken: generateCsrfToken(),
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
export async function createScoutSession(params: ScoutSessionParams): Promise<string> {
  startSigningServer();

  const id = generateSessionId();
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

  await setSession(id, {
    type: "scout",
    id,
    csrfToken: generateCsrfToken(),
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
export async function getSessionStatus(sessionId: string): Promise<Session | null> {
  const session = await getSession<Session>(sessionId);
  if (!session) return null;
  if (session.type === "sign") return session.complete ? session : null;
  return session.phase === "complete" ? session : null;
}
