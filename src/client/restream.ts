/** Placeholder for RestreamClient WebSocket integration (not exported by current SDK version). */

/**
 * RestreamClient is referenced in the PRD but not yet exported by @bagsfm/bags-sdk.
 * This module provides a stub that can be replaced when the SDK adds WebSocket support.
 * For now, live launch data comes through the REST /token-launch/feed endpoint.
 */

let connected = false;

/** Check if RestreamClient would be available. Currently always returns false. */
export function isRestreamAvailable(): boolean {
  return false;
}

/** Stub: connect to the Bags launch WebSocket. */
export async function connectRestream(): Promise<void> {
  console.error("[restream] RestreamClient not available in current SDK version. Using REST feed instead.");
  connected = true;
}

/** Stub: disconnect from the Bags launch WebSocket. */
export function disconnectRestream(): void {
  connected = false;
}
