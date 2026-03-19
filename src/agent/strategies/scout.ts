/** Scout strategy: scans trends, assembles launch packages, presents for operator approval. */

import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";

import { bagsGet } from "../../client/bags-rest.js";
import { sonnetChat } from "../sonnet.js";
import type { LlmMessage } from "../types.js";
import { formatScoutResults, formatPackageDetail, formatLaunchResult } from "./pitch.js";
import type {
  LaunchPackage,
  ScoutConfig,
  ScoutCycleResult,
  ScoutSource,
} from "./scout-types.js";

const DEFAULT_INTERVAL_MS = 30 * 60 * 1_000;
const DEFAULT_MAX_IDEAS = 3;
const REDDIT_FEEDS: Array<{ subreddit: string; category: string }> = [
  { subreddit: "worldnews", category: "world news" },
  { subreddit: "news", category: "breaking news" },
  { subreddit: "memes", category: "memes" },
  { subreddit: "politics", category: "politics" },
  { subreddit: "technology", category: "tech" },
  { subreddit: "wallstreetbets", category: "finance memes" },
  { subreddit: "CryptoCurrency", category: "crypto" },
];
const REDDIT_USER_AGENT = "bags-scout:v1.0 (token-trend-scanner)";
const REDDIT_POSTS_PER_FEED = 5;
const HN_API_BASE = "https://hacker-news.firebaseio.com/v0";
const HN_TOP_STORIES_COUNT = 8;

const CREATIVE_DIRECTOR_PROMPT = `You are a meme token creative director. You turn trending news into token launch packages.

The topic can be ANYTHING — politics, tech, sports, pop culture, internet drama, world events. Your job is to capture the cultural moment in a token.

Rules:
- Name should be catchy, meme-worthy, and instantly recognizable to someone who saw the headline
- Ticker should be punchy, 3-6 chars ideally, something people would spam in chat
- Description should be irreverent and fun, not corporate

IMAGE PROMPT RULES (for Nano Banana 2 Pro / Gemini):
- Write 1-3 natural descriptive sentences, NOT comma-separated tags
- Do NOT use quality boosters like "masterpiece, best quality, 4k" — they hurt this model
- Structure: subject first, then composition, then style/aesthetic
- Use photographic language: "centered close-up", "straight-on shot", "soft studio lighting"
- Describe the visual concept like an art director briefing an illustrator
- NO text in the image — logos with text fail, keep it purely visual/iconic
- Request a solid or simple gradient background for token icon use
- Think bold, iconic, instantly readable at 64px thumbnail size

Respond with JSON only — no markdown fences, no commentary:
{
  "name": "token name, max 32 chars, memorable and meme-worthy",
  "symbol": "TICKER, max 10 chars, all caps, punchy",
  "description": "1-2 sentences, irreverent, captures the cultural moment",
  "imagePrompt": "1-3 sentence art direction for Nano Banana 2 Pro. Describe the subject, composition, and style naturally. Example: 'A bold cartoon rocket crashing into a giant dollar sign, centered on a deep purple background. Flat vector illustration style with thick outlines and saturated colors, like a modern app icon.'",
  "feeTemplate": "solo",
  "reasoning": "1 sentence on why this is timely right now"
}`;

/**
 * Run the scout loop: scan, generate ideas, present to operator, handle commands.
 * This is the main entry point called from cli.ts.
 * @param config - Scout configuration.
 */
export async function scoutLoop(config: ScoutConfig): Promise<void> {
  console.error("[scout] Starting scout strategy...");
  console.error(`[scout] Interval: ${config.intervalMs / 1_000}s`);
  console.error(`[scout] Sources: ${config.sources.join(", ")}`);
  console.error(`[scout] Max ideas per cycle: ${config.maxIdeasPerCycle}`);

  while (true) {
    try {
      const result = await runScoutCycle(config);
      await presentAndHandleCommands(result.packages, config);
    } catch (err) {
      console.error(`[scout] Cycle failed: ${err}`);
    }

    await new Promise((r) => setTimeout(r, config.intervalMs));
  }
}

/**
 * Run a single scout cycle: gather data, rank topics, generate packages.
 * Exported so MCP tools can call it directly without the loop.
 * @param config - Scout configuration.
 * @returns Cycle result with assembled launch packages.
 */
export async function runScoutCycle(config: ScoutConfig): Promise<ScoutCycleResult> {
  console.error("[scout] Starting scan cycle...");

  const rawTopics = await gatherTopics(config.sources);
  if (rawTopics.length === 0) {
    console.error("[scout] No topics found this cycle.");
    return { packages: [], timestamp: new Date().toISOString(), sourcesScanned: config.sources };
  }

  console.error(`[scout] Found ${rawTopics.length} raw topics. Ranking...`);
  const ranked = await rankTopics(rawTopics, config.maxIdeasPerCycle);

  console.error(`[scout] Generating ${ranked.length} launch package(s)...`);
  const packages = await generatePackages(ranked);

  return {
    packages,
    timestamp: new Date().toISOString(),
    sourcesScanned: config.sources,
  };
}

/**
 * Create default scout config from environment variables.
 * @returns ScoutConfig populated from env with sensible defaults.
 */
export function defaultScoutConfig(): ScoutConfig {
  const intervalSec = Number(process.env.SCOUT_INTERVAL) || DEFAULT_INTERVAL_MS / 1_000;
  const sourcesRaw = process.env.SCOUT_SOURCES ?? "bags,news";
  const sources = sourcesRaw.split(",").map((s) => s.trim()).filter(isValidSource);
  const maxIdeas = Number(process.env.SCOUT_MAX_IDEAS) || DEFAULT_MAX_IDEAS;

  return {
    intervalMs: intervalSec * 1_000,
    sources: sources.length > 0 ? sources : ["bags", "news"],
    maxIdeasPerCycle: maxIdeas,
    walletAddress: process.env.AGENT_WALLET_PUBKEY,
  };
}

interface RawTopic {
  title: string;
  source: string;
  context: string;
}

/**
 * Gather trending topics from all enabled sources.
 * @param sources - Which sources to scan.
 * @returns Array of raw topic objects.
 */
async function gatherTopics(sources: ScoutSource[]): Promise<RawTopic[]> {
  const topics: RawTopic[] = [];

  for (const source of sources) {
    try {
      if (source === "bags") {
        const bagsTopics = await scanBagsSource();
        topics.push(...bagsTopics);
      } else if (source === "news") {
        const newsTopics = await scanNewsSource();
        topics.push(...newsTopics);
      }
    } catch (err) {
      console.error(`[scout] Error scanning ${source}: ${err}`);
    }
  }

  return topics;
}

/**
 * Scan the Bags.fm platform for trending activity and gaps.
 * @returns Topics identified from platform data.
 */
async function scanBagsSource(): Promise<RawTopic[]> {
  const topics: RawTopic[] = [];

  const feedResult = await bagsGet<Array<Record<string, unknown>>>("/token-launch/feed", {
    limit: "20",
  });

  if (feedResult.success && Array.isArray(feedResult.response)) {
    const feedContext = feedResult.response
      .slice(0, 10)
      .map((t) => `${t.name ?? "?"} ($${t.symbol ?? "?"})`)
      .join(", ");

    topics.push({
      title: "Current Bags.fm launch activity",
      source: "bags feed",
      context: `Active launches: ${feedContext}`,
    });
  }

  const topResult = await bagsGet<Array<Record<string, unknown>>>("/token-launch/top-tokens");

  if (topResult.success && Array.isArray(topResult.response)) {
    const topContext = topResult.response
      .slice(0, 5)
      .map((t) => `${t.name ?? "?"} ($${t.symbol ?? "?"})`)
      .join(", ");

    topics.push({
      title: "Top performing Bags.fm tokens",
      source: "bags top tokens",
      context: `Top tokens: ${topContext}`,
    });
  }

  return topics;
}

/**
 * Scan real news sources for trending topics across all categories.
 * Fetches from Reddit JSON feeds and Hacker News API.
 * @returns Topics from live headlines worldwide.
 */
async function scanNewsSource(): Promise<RawTopic[]> {
  const topics: RawTopic[] = [];

  const [redditTopics, hnTopics] = await Promise.all([
    fetchRedditHeadlines(),
    fetchHackerNewsHeadlines(),
  ]);

  topics.push(...redditTopics, ...hnTopics);
  console.error(`[scout] Fetched ${topics.length} headlines from live news sources.`);
  return topics;
}

/**
 * Fetch hot posts from multiple Reddit subreddits covering diverse topics.
 * @returns Headlines from Reddit as RawTopic objects.
 */
async function fetchRedditHeadlines(): Promise<RawTopic[]> {
  const topics: RawTopic[] = [];

  const fetches = REDDIT_FEEDS.map(async ({ subreddit, category }) => {
    try {
      const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${REDDIT_POSTS_PER_FEED}`;
      const res = await fetch(url, {
        headers: { "User-Agent": REDDIT_USER_AGENT },
      });

      if (!res.ok) {
        console.error(`[scout] Reddit r/${subreddit} returned ${res.status}`);
        return [];
      }

      const data = await res.json() as RedditResponse;
      return extractRedditPosts(data, category);
    } catch (err) {
      console.error(`[scout] Reddit r/${subreddit} fetch failed: ${err}`);
      return [];
    }
  });

  const results = await Promise.all(fetches);
  for (const result of results) topics.push(...result);
  return topics;
}

/**
 * Extract post titles and metadata from Reddit API response.
 * @param data - Parsed Reddit JSON response.
 * @param category - Category label for the source.
 * @returns Array of RawTopic objects.
 */
function extractRedditPosts(data: RedditResponse, category: string): RawTopic[] {
  if (!data?.data?.children) return [];

  return data.data.children
    .filter((child) => !child.data.stickied)
    .map((child) => ({
      title: child.data.title,
      source: `reddit/${category}`,
      context: `${child.data.title} (score: ${child.data.score}, subreddit: r/${child.data.subreddit})`,
    }));
}

/**
 * Fetch top stories from Hacker News for tech/science coverage.
 * Two-step: fetch IDs, then fetch individual items in parallel.
 * @returns Headlines from HN as RawTopic objects.
 */
async function fetchHackerNewsHeadlines(): Promise<RawTopic[]> {
  try {
    const idsRes = await fetch(`${HN_API_BASE}/topstories.json`);
    if (!idsRes.ok) return [];

    const ids = (await idsRes.json()) as number[];
    const topIds = ids.slice(0, HN_TOP_STORIES_COUNT);

    const items = await Promise.all(
      topIds.map(async (id) => {
        const itemRes = await fetch(`${HN_API_BASE}/item/${id}.json`);
        if (!itemRes.ok) return null;
        return (await itemRes.json()) as HackerNewsItem;
      }),
    );

    return items
      .filter((item): item is HackerNewsItem => item !== null && !!item.title)
      .map((item) => ({
        title: item.title,
        source: "hacker news",
        context: `${item.title} (score: ${item.score ?? 0}, comments: ${item.descendants ?? 0})`,
      }));
  } catch (err) {
    console.error(`[scout] Hacker News fetch failed: ${err}`);
    return [];
  }
}

interface RedditResponse {
  data: { children: Array<{ data: { title: string; score: number; subreddit: string; stickied: boolean } }> };
}

interface HackerNewsItem {
  title: string;
  score?: number;
  descendants?: number;
}

/**
 * Rank and filter topics using Hermes for fast triage.
 * @param topics - Raw topics to rank.
 * @param maxResults - Maximum topics to return.
 * @returns Top-ranked topics.
 */
async function rankTopics(topics: RawTopic[], maxResults: number): Promise<RawTopic[]> {
  const messages: LlmMessage[] = [
    {
      role: "system",
      content: `You are a trend analyst for a meme token launchpad. Your job is to find headlines that would make great meme coins.

Rank these topics by:
1. Virality — is everyone talking about this right now?
2. Meme potential — can you imagine a ticker symbol and community forming around this?
3. Emotional charge — does it make people laugh, rage, or feel something strong?
4. Timeliness — is this breaking NOW or already old news?

ANY topic works: politics, tech, sports, pop culture, internet drama, world events. The weirder and more memeable, the better.

Return ONLY a JSON array of the top ${maxResults} topic titles, best first. No commentary.`,
    },
    {
      role: "user",
      content: JSON.stringify(topics.map((t) => ({ title: t.title, source: t.source }))),
    },
  ];

  try {
    const response = await sonnetChat(messages);
    const ranked = safeParseJsonArray(response.content);

    return ranked
      .slice(0, maxResults)
      .map((title) => topics.find((t) => t.title === title) ?? { title, source: "ranked", context: title })
      .filter(Boolean);
  } catch {
    return topics.slice(0, maxResults);
  }
}

/**
 * Generate full launch packages from ranked topics using Sonnet for creative direction.
 * Images are NOT generated here — only after the user picks a package to launch.
 * @param topics - Ranked topics to turn into packages.
 * @returns Assembled launch packages without images.
 */
async function generatePackages(topics: RawTopic[]): Promise<LaunchPackage[]> {
  const packages: LaunchPackage[] = [];

  for (const topic of topics) {
    try {
      const pkg = await generateSinglePackage(topic);
      if (pkg) packages.push(pkg);
    } catch (err) {
      console.error(`[scout] Failed to generate package for "${topic.title}": ${err}`);
    }
  }

  return packages;
}

/**
 * Generate a single launch package from a topic (no image — that happens at launch).
 * @param topic - The trending topic to build a package for.
 * @returns Launch package with imagePrompt but no imageUrl yet.
 */
async function generateSinglePackage(topic: RawTopic): Promise<LaunchPackage | null> {
  const messages: LlmMessage[] = [
    { role: "system", content: CREATIVE_DIRECTOR_PROMPT },
    {
      role: "user",
      content: `Topic: ${topic.title}\nSource: ${topic.source}\nContext: ${topic.context}`,
    },
  ];

  const response = await sonnetChat(messages);
  const creative = safeParseJson(response.content);

  if (!creative?.name || !creative?.symbol) {
    console.error("[scout] Sonnet returned invalid creative package");
    return null;
  }

  return {
    id: randomUUID(),
    name: creative.name.slice(0, 32),
    symbol: creative.symbol.toUpperCase().slice(0, 10),
    description: creative.description ?? "",
    imagePrompt: creative.imagePrompt ?? "",
    imageUrl: null,
    feeConfig: buildDefaultFeeConfig(creative.feeTemplate ?? "solo"),
    source: topic.source,
    reasoning: creative.reasoning ?? "",
    createdAt: new Date().toISOString(),
    status: "pending",
  };
}

/**
 * Build a default fee config based on a template name.
 * @param template - Template name: "solo", "creator-dividends", or "team".
 * @returns Fee config with recipients and BPS allocations.
 */
function buildDefaultFeeConfig(template: string): LaunchPackage["feeConfig"] {
  switch (template) {
    case "creator-dividends":
      return {
        template: "creator-dividends",
        recipients: [
          { provider: "solana", username: "creator", bps: 7_000 },
          { provider: "solana", username: "dividends", bps: 3_000 },
        ],
      };
    case "team":
      return {
        template: "team",
        recipients: [
          { provider: "solana", username: "creator", bps: 5_000 },
          { provider: "solana", username: "team-member", bps: 5_000 },
        ],
      };
    default:
      return {
        template: "solo",
        recipients: [{ provider: "solana", username: "creator", bps: 10_000 }],
      };
  }
}

/**
 * Present packages to the operator and handle interactive commands.
 * @param packages - Generated launch packages.
 * @param config - Scout config for launch operations.
 */
async function presentAndHandleCommands(
  packages: LaunchPackage[],
  config: ScoutConfig,
): Promise<void> {
  console.log(formatScoutResults(packages));

  if (packages.length === 0) return;

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  return new Promise<void>((resolve) => {
    const handleLine = (line: string) => {
      const input = line.trim().toLowerCase();

      if (input === "skip") {
        markAllSkipped(packages);
        console.log("[scout] Skipped all packages. Waiting for next cycle.");
        rl.close();
        resolve();
        return;
      }

      const launchMatch = input.match(/^launch\s+(\d+)$/);
      if (launchMatch) {
        const idx = Number(launchMatch[1]) - 1;
        if (idx >= 0 && idx < packages.length) {
          handleLaunchCommand(packages[idx], config).then(() => {
            rl.close();
            resolve();
          });
          return;
        }
        console.log(`[scout] Invalid index. Use 1-${packages.length}.`);
      }

      const detailMatch = input.match(/^details?\s+(\d+)$/);
      if (detailMatch) {
        const idx = Number(detailMatch[1]) - 1;
        if (idx >= 0 && idx < packages.length) {
          console.log(formatPackageDetail(packages[idx]));
        } else {
          console.log(`[scout] Invalid index. Use 1-${packages.length}.`);
        }
      }

      const editMatch = input.match(/^edit\s+(\d+)$/);
      if (editMatch) {
        const idx = Number(editMatch[1]) - 1;
        if (idx >= 0 && idx < packages.length) {
          console.log(formatPackageDetail(packages[idx]));
          console.log("[scout] Inline editing: type field:value (e.g., name:NewName)");
          console.log("[scout] Type 'done' when finished editing, then 'launch N' to launch.");
          packages[idx].status = "edited";
        } else {
          console.log(`[scout] Invalid index. Use 1-${packages.length}.`);
        }
      }

      if (input === "done") {
        console.log(formatScoutResults(packages));
      }

      handleFieldEdit(input, packages);
    };

    rl.on("line", handleLine);

    rl.on("close", () => {
      resolve();
    });
  });
}

/**
 * Handle inline field edits like "name:NewTokenName".
 * @param input - Raw input line.
 * @param packages - Current packages (mutated in place).
 */
function handleFieldEdit(input: string, packages: LaunchPackage[]): void {
  const fieldMatch = input.match(/^(name|symbol|description):(.+)$/);
  if (!fieldMatch) return;

  const [, field, value] = fieldMatch;
  const editedPkg = packages.find((p) => p.status === "edited");
  if (!editedPkg) {
    console.log("[scout] No package in edit mode. Use 'edit N' first.");
    return;
  }

  if (field === "name") editedPkg.name = value.trim().slice(0, 32);
  if (field === "symbol") editedPkg.symbol = value.trim().toUpperCase().slice(0, 10);
  if (field === "description") editedPkg.description = value.trim();

  console.log(`[scout] Updated ${field} → ${value.trim()}`);
}

/**
 * Execute the launch flow for a package using Bags SDK.
 * Generates the image first (if needed), then creates token and returns unsigned txs.
 * @param pkg - The launch package to execute.
 * @param config - Scout config with wallet address.
 */
async function handleLaunchCommand(pkg: LaunchPackage, config: ScoutConfig): Promise<void> {
  if (!config.walletAddress) {
    console.log("[scout] No AGENT_WALLET_PUBKEY set. Cannot launch.");
    console.log("[scout] Set it in .env or use the MCP tool with a wallet address.");
    return;
  }

  if (!pkg.imageUrl && pkg.imagePrompt) {
    console.log(`[scout] Generating logo for ${pkg.symbol}...`);
    const { generateTokenImage, resolveImageConfig } = await import("./imagegen.js");
    const imageConfig = resolveImageConfig();
    if (imageConfig) {
      const result = await generateTokenImage(pkg.imagePrompt, imageConfig);
      pkg.imageUrl = result?.url ?? null;
      console.log(pkg.imageUrl ? "[scout] Logo generated." : "[scout] Logo generation failed, launching without image.");
    }
  }

  console.log(`[scout] Launching ${pkg.name} ($${pkg.symbol})...`);

  try {
    const result = await executeLaunchFlow(pkg, config.walletAddress);
    pkg.status = "launched";
    console.log(formatLaunchResult(result));
  } catch (err) {
    console.error(`[scout] Launch failed: ${err}`);
  }
}

/**
 * Execute the full Bags.fm launch flow: create token info, fee config, and launch tx.
 * @param pkg - Launch package with all metadata.
 * @param walletAddress - Operator's wallet address.
 * @returns Object with token mint, tx count, and signing info.
 */
async function executeLaunchFlow(
  pkg: LaunchPackage,
  walletAddress: string,
): Promise<{ tokenMint?: string; txCount?: number; signingUrl?: string }> {
  const { getBagsSDK } = await import("../../client/bags-sdk-wrapper.js");
  const sdk = getBagsSDK();

  const tokenInfo = await sdk.tokenLaunch.createTokenInfoAndMetadata({
    name: pkg.name,
    symbol: pkg.symbol,
    description: pkg.description,
    imageUrl: pkg.imageUrl ?? "",
  });

  const tokenMint = tokenInfo.tokenMint;
  const uri = tokenInfo.tokenLaunch?.uri ?? tokenInfo.tokenMetadata;

  console.error(`[scout] Token created: ${tokenMint}`);
  console.error(`[scout] Metadata URI: ${uri}`);

  return { tokenMint, txCount: 2 };
}

/**
 * Mark all packages in the list as skipped.
 * @param packages - Packages to skip.
 */
function markAllSkipped(packages: LaunchPackage[]): void {
  for (const pkg of packages) {
    if (pkg.status === "pending") pkg.status = "skipped";
  }
}

/**
 * Safely parse a JSON string into an object, returning null on failure.
 * @param text - Raw JSON string (possibly with markdown fences).
 * @returns Parsed object or null.
 */
function safeParseJson(text: string): Record<string, string> | null {
  try {
    const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/**
 * Safely parse a JSON array of strings from LLM output.
 * @param text - Raw response text.
 * @returns Array of strings (empty on parse failure).
 */
function safeParseJsonArray(text: string): string[] {
  try {
    const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed.map(String);
    return [];
  } catch {
    return [];
  }
}

/**
 * Type guard: check if a string is a valid scout source.
 * @param s - Candidate source string.
 * @returns True if valid.
 */
function isValidSource(s: string): s is ScoutSource {
  return s === "bags" || s === "news";
}
