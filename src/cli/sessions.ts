/** Clear the signing session store file. */

import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const STORE_PATH = resolve(THIS_DIR, "../../.sessions/sessions.json");

/**
 * Delete the sessions file and report how many were cleared.
 */
export function clearSessions(): void {
  if (!existsSync(STORE_PATH)) {
    console.log("\n  No sessions file found. Nothing to clear.");
    return;
  }

  const count = countSessions();
  unlinkSync(STORE_PATH);
  console.log(`\n  Cleared ${count} session${count === 1 ? "" : "s"} from .sessions/sessions.json`);
}

/**
 * Count sessions in the store file.
 * @returns Number of session entries, or 0 on error.
 */
function countSessions(): number {
  try {
    const raw = readFileSync(STORE_PATH, "utf8");
    return Object.keys(JSON.parse(raw)).length;
  } catch {
    return 0;
  }
}
