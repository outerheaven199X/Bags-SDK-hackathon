/** Print the package version and exit. */

import { SERVER_NAME, SERVER_VERSION } from "../utils/constants.js";

/**
 * Print the server name and version to stdout.
 */
export function printVersion(): void {
  console.log(`${SERVER_NAME} v${SERVER_VERSION}`);
}
