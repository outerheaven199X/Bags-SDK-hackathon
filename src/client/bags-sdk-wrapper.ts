/** Singleton wrapper around @bagsfm/bags-sdk for shared access across tools. */

import { BagsSDK } from "@bagsfm/bags-sdk";
import { Connection } from "@solana/web3.js";

import { DEFAULT_RPC_URL } from "../utils/constants.js";

let sdk: BagsSDK | null = null;
let connection: Connection | null = null;

/**
 * Get or create the shared Solana RPC connection.
 * Reads SOLANA_RPC_URL from environment, falls back to DEFAULT_RPC_URL.
 * @returns Singleton Connection instance.
 */
export function getConnection(): Connection {
  if (!connection) {
    const rpcUrl = process.env.SOLANA_RPC_URL || DEFAULT_RPC_URL;
    connection = new Connection(rpcUrl);
  }
  return connection;
}

/**
 * Get or create the shared BagsSDK instance.
 * Reads BAGS_API_KEY and SOLANA_RPC_URL from environment.
 * Reuses the singleton Connection from getConnection().
 * @returns Initialized BagsSDK connected to mainnet.
 */
export function getBagsSDK(): BagsSDK {
  if (!sdk) {
    const apiKey = process.env.BAGS_API_KEY;
    if (!apiKey) throw new Error("BAGS_API_KEY is required. Get one at dev.bags.fm");

    sdk = new BagsSDK(apiKey, getConnection(), "confirmed");
  }
  return sdk;
}
