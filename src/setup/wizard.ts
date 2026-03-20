/** Interactive setup wizard — prompts for API key, detects clients, writes configs. */

import { createInterface, Interface } from "node:readline";
import { detectClients, type DetectedClient } from "./detect.js";
import { installConfig, uninstallConfig, isAlreadyInstalled } from "./config-write.js";

const DEV_PORTAL_URL = "https://dev.bags.fm";
const SERVER_LABEL = "bags-sdk-mcp";
const TOOL_COUNT = 46;
const RESOURCE_COUNT = 4;
const PROMPT_COUNT = 6;

/**
 * Run the interactive setup wizard.
 * Collects API key, detects MCP clients, writes config to each.
 */
export async function runSetupWizard(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    printHeader();
    const apiKey = await collectApiKey(rl);
    const clients = detectClients();

    if (clients.length === 0) {
      printNoClientsFound();
      return;
    }

    printDetectedClients(clients);
    const targets = await selectTargets(rl, clients);

    if (targets.length === 0) {
      console.log("\n  Nothing to install. Exiting.");
      return;
    }

    await confirmAndInstall(rl, targets, apiKey);
  } finally {
    rl.close();
  }
}

/**
 * Run the uninstall flow — remove bags-sdk-mcp from all detected configs.
 */
export async function runUninstallWizard(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const clients = detectClients();
    const installed = clients.filter((c) => isAlreadyInstalled(c.configPath));

    if (installed.length === 0) {
      console.log(`\n  ${SERVER_LABEL} is not configured in any detected client.`);
      return;
    }

    console.log(`\n  Found ${SERVER_LABEL} in:`);
    for (const client of installed) {
      console.log(`    \u2713 ${client.name}`);
    }

    const confirm = await ask(rl, "\n  Remove from all? (y/N): ");
    if (confirm.toLowerCase() !== "y") {
      console.log("  Cancelled.");
      return;
    }

    for (const client of installed) {
      const result = uninstallConfig(client.configPath);
      const icon = result.success ? "\u2713" : "\u2717";
      const msg = result.success
        ? `Removed from ${client.name}`
        : `Failed: ${result.error}`;
      console.log(`  ${icon} ${msg}`);
    }

    console.log("\n  Restart your clients to complete removal.");
  } finally {
    rl.close();
  }
}

function printHeader(): void {
  console.log(`\n  ${SERVER_LABEL} setup`);
  console.log("  " + "\u2500".repeat(SERVER_LABEL.length + 6));
}

/**
 * Prompt for the BAGS_API_KEY, re-prompting with a hint on empty input.
 * @param rl - The readline interface.
 * @returns The user-provided API key.
 */
async function collectApiKey(rl: Interface): Promise<string> {
  let key = await ask(rl, `\n  API Key (from ${DEV_PORTAL_URL}): `);

  if (!key.trim()) {
    console.log(`\n  No key? Get one free at ${DEV_PORTAL_URL}`);
    key = await ask(rl, "  API Key: ");
  }

  if (!key.trim()) {
    console.log("  API key is required. Exiting.");
    process.exit(1);
  }

  return key.trim();
}

/**
 * Print detected MCP clients and their config paths.
 * @param clients - The detected clients.
 */
function printDetectedClients(clients: DetectedClient[]): void {
  console.log("\n  Detected MCP clients:");
  for (const client of clients) {
    console.log(`    \u2713 ${padRight(client.name, 18)} ${client.configPath}`);
  }
}

/**
 * Let the user confirm which clients to install to.
 * By default all detected clients are selected.
 * @param rl - The readline interface.
 * @param clients - The detected clients.
 * @returns The clients the user wants to install to.
 */
async function selectTargets(
  rl: Interface,
  clients: DetectedClient[],
): Promise<DetectedClient[]> {
  console.log("\n  Install to:");
  for (const client of clients) {
    console.log(`    [x] ${client.name}`);
  }

  const answer = await ask(rl, "\n  Press Enter to install, or Ctrl+C to cancel. ");
  void answer; // User just presses Enter to confirm
  return clients;
}

/**
 * Confirm overwrites for existing installs, then write configs.
 * @param rl - The readline interface.
 * @param targets - Clients to install to.
 * @param apiKey - The user's API key.
 */
async function confirmAndInstall(
  rl: Interface,
  targets: DetectedClient[],
  apiKey: string,
): Promise<void> {
  console.log();

  for (const client of targets) {
    if (isAlreadyInstalled(client.configPath)) {
      const answer = await ask(
        rl,
        `  ${SERVER_LABEL} is already configured in ${client.name}. Overwrite? (y/N): `,
      );
      if (answer.toLowerCase() !== "y") {
        console.log(`  Skipped ${client.name}.`);
        continue;
      }
    }

    const result = installConfig(client.configPath, apiKey);
    const icon = result.success ? "\u2713" : "\u2717";
    const msg = result.success
      ? `${client.name} config updated`
      : `${client.name} failed: ${result.error}`;
    console.log(`  ${icon} ${msg}`);
  }

  console.log(`\n  Restart your client to load ${SERVER_LABEL}.`);
  console.log(`  ${TOOL_COUNT} tools, ${RESOURCE_COUNT} resources, ${PROMPT_COUNT} prompts ready.`);
}

/** Print manual install instructions when no clients are detected. */
function printNoClientsFound(): void {
  console.log("\n  No MCP clients detected.");
  console.log("  Install manually by adding this to your MCP config file:\n");
  console.log('  {');
  console.log('    "mcpServers": {');
  console.log(`      "${SERVER_LABEL}": {`);
  console.log('        "command": "npx",');
  console.log(`        "args": ["${SERVER_LABEL}"],`);
  console.log('        "env": {');
  console.log('          "BAGS_API_KEY": "your-key-here"');
  console.log("        }");
  console.log("      }");
  console.log("    }");
  console.log("  }\n");
  console.log("  Config file locations:");
  console.log("    Claude Desktop (macOS):   ~/Library/Application Support/Claude/claude_desktop_config.json");
  console.log("    Claude Desktop (Windows): %APPDATA%/Claude/claude_desktop_config.json");
  console.log("    Cursor:                   .cursor/mcp.json in project root");
  console.log("    Claude Code:              .mcp.json in project root");
}

/**
 * Prompt the user and return their input.
 * @param rl - The readline interface.
 * @param prompt - The prompt string to display.
 * @returns The user's input string.
 */
function ask(rl: Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer));
  });
}

/**
 * Right-pad a string to a minimum width.
 * @param str - The string to pad.
 * @param width - The target width.
 * @returns The padded string.
 */
function padRight(str: string, width: number): string {
  return str.length >= width ? str : str + " ".repeat(width - str.length);
}
