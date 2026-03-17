/** Direct REST client for Bags API endpoints NOT covered by @bagsfm/bags-sdk. */

import { DEFAULT_API_BASE } from "../utils/constants.js";
import type { BagsResponse } from "./types.js";

function getBase(): string {
  return process.env.BAGS_API_BASE || DEFAULT_API_BASE;
}

function getApiKey(): string {
  const key = process.env.BAGS_API_KEY;
  if (!key) throw new Error("BAGS_API_KEY is required. Get one at dev.bags.fm");
  return key;
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
    return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
  }

  return res.json() as Promise<BagsResponse<T>>;
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
    return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
  }

  return res.json() as Promise<BagsResponse<T>>;
}
