/** Direct REST client for Bags API endpoints NOT covered by @bagsfm/bags-sdk. */

import { DEFAULT_API_BASE } from "../utils/constants.js";
import type { BagsResponse } from "./types.js";

const ERROR_BODY_MAX_LENGTH = 200;

function getBase(): string {
  return process.env.BAGS_API_BASE || DEFAULT_API_BASE;
}

function getApiKey(): string {
  const key = process.env.BAGS_API_KEY;
  if (!key) throw new Error("BAGS_API_KEY is required. Get one at dev.bags.fm");
  return key;
}

/**
 * Read the response body on HTTP errors so callers get a useful message.
 * @param res - Fetch response with !res.ok.
 * @returns A BagsResponse with the error detail.
 */
async function errorFromResponse<T>(res: Response): Promise<BagsResponse<T>> {
  const body = await res.text();
  let detail: string;
  try {
    const parsed = JSON.parse(body);
    detail = parsed?.error ?? body.slice(0, ERROR_BODY_MAX_LENGTH);
  } catch {
    detail = body.slice(0, ERROR_BODY_MAX_LENGTH);
  }
  return { success: false, error: `HTTP ${res.status}: ${detail}` };
}

/**
 * Validate that the parsed JSON matches the expected BagsResponse shape.
 * @param json - Parsed JSON response.
 * @returns Validated BagsResponse or a failure wrapper.
 */
function validateResponseShape<T>(json: unknown): BagsResponse<T> {
  if (typeof json !== "object" || json === null || typeof (json as Record<string, unknown>).success !== "boolean") {
    const preview = JSON.stringify(json).slice(0, ERROR_BODY_MAX_LENGTH);
    return { success: false, error: `Unexpected API response shape: ${preview}` };
  }
  return json as BagsResponse<T>;
}

/**
 * Perform a GET request against the Bags public API.
 * @param path - API path (e.g. "/fee-share/resolve-wallet").
 * @param params - Optional query string parameters.
 * @returns Typed Bags API response wrapper.
 */
export async function bagsGet<T>(
  path: string,
  params?: Record<string, string>,
): Promise<BagsResponse<T>> {
  const url = new URL(`${getBase()}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { "x-api-key": getApiKey() },
  });

  if (!res.ok) {
    return errorFromResponse<T>(res);
  }

  const json = await res.json();
  return validateResponseShape<T>(json);
}

/**
 * Perform a POST request against the Bags public API.
 * @param path - API path (e.g. "/fee-share/create-config").
 * @param body - JSON-serializable request body.
 * @returns Typed Bags API response wrapper.
 */
export async function bagsPost<T>(
  path: string,
  body: unknown,
): Promise<BagsResponse<T>> {
  const res = await fetch(`${getBase()}${path}`, {
    method: "POST",
    headers: {
      "x-api-key": getApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return errorFromResponse<T>(res);
  }

  const json = await res.json();
  return validateResponseShape<T>(json);
}
