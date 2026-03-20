/** Unit tests for safe JSON config read/merge/write operations. */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
}));

vi.mock("node:crypto", () => ({
  randomBytes: vi.fn(() => Buffer.from("deadbeef", "hex")),
}));

const fs = vi.mocked(await import("node:fs"));

import {
  installConfig,
  uninstallConfig,
  isAlreadyInstalled,
  buildServerConfig,
} from "../../src/setup/config-write.js";

const TEST_PATH = "/tmp/test-config.json";
const TEST_KEY = "test-api-key-123";

describe("buildServerConfig", () => {
  it("returns correct structure with api key", () => {
    const config = buildServerConfig(TEST_KEY);

    expect(config).toEqual({
      command: "npx",
      args: ["bags-sdk-mcp"],
      env: {
        BAGS_API_KEY: TEST_KEY,
        SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
      },
    });
  });
});

describe("installConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates valid JSON with mcpServers when file does not exist", () => {
    fs.existsSync.mockReturnValue(false);
    fs.writeFileSync.mockImplementation(() => {});
    fs.renameSync.mockImplementation(() => {});

    const result = installConfig(TEST_PATH, TEST_KEY);

    expect(result.success).toBe(true);
    expect(fs.writeFileSync).toHaveBeenCalled();

    const written = fs.writeFileSync.mock.calls[0][1] as string;
    const parsed = JSON.parse(written);
    expect(parsed.mcpServers["bags-sdk-mcp"]).toBeDefined();
    expect(parsed.mcpServers["bags-sdk-mcp"].env.BAGS_API_KEY).toBe(TEST_KEY);
  });

  it("preserves other servers when adding to existing config", () => {
    const existing = JSON.stringify({
      mcpServers: {
        "other-server": { command: "npx", args: ["other-server"] },
      },
    });

    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(existing);
    fs.writeFileSync.mockImplementation(() => {});
    fs.renameSync.mockImplementation(() => {});

    const result = installConfig(TEST_PATH, TEST_KEY);

    expect(result.success).toBe(true);

    const written = fs.writeFileSync.mock.calls[0][1] as string;
    const parsed = JSON.parse(written);
    expect(parsed.mcpServers["other-server"]).toBeDefined();
    expect(parsed.mcpServers["bags-sdk-mcp"]).toBeDefined();
  });

  it("overwrites existing bags-sdk-mcp entry", () => {
    const existing = JSON.stringify({
      mcpServers: {
        "bags-sdk-mcp": { command: "old", args: ["old"] },
        "other-server": { command: "npx", args: ["other"] },
      },
    });

    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(existing);
    fs.writeFileSync.mockImplementation(() => {});
    fs.renameSync.mockImplementation(() => {});

    const result = installConfig(TEST_PATH, "new-key");

    expect(result.success).toBe(true);

    const written = fs.writeFileSync.mock.calls[0][1] as string;
    const parsed = JSON.parse(written);
    expect(parsed.mcpServers["bags-sdk-mcp"].env.BAGS_API_KEY).toBe("new-key");
    expect(parsed.mcpServers["other-server"]).toBeDefined();
  });

  it("returns error on malformed JSON without writing", () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue("{ invalid json }}}");

    const result = installConfig(TEST_PATH, TEST_KEY);

    expect(result.success).toBe(false);
    expect(result.error).toContain("invalid JSON");
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it("falls back to direct write when rename fails", () => {
    fs.existsSync.mockReturnValue(false);
    fs.writeFileSync.mockImplementation(() => {});
    fs.renameSync.mockImplementation(() => {
      throw new Error("rename not supported");
    });

    const result = installConfig(TEST_PATH, TEST_KEY);

    expect(result.success).toBe(true);
    // writeFileSync called twice: once for tmp, once for direct fallback
    expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
  });
});

describe("uninstallConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes bags-sdk-mcp and preserves other servers", () => {
    const existing = JSON.stringify({
      mcpServers: {
        "bags-sdk-mcp": { command: "npx", args: ["bags-sdk-mcp"] },
        "other-server": { command: "npx", args: ["other"] },
      },
    });

    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(existing);
    fs.writeFileSync.mockImplementation(() => {});
    fs.renameSync.mockImplementation(() => {});

    const result = uninstallConfig(TEST_PATH);

    expect(result.success).toBe(true);

    const written = fs.writeFileSync.mock.calls[0][1] as string;
    const parsed = JSON.parse(written);
    expect(parsed.mcpServers["bags-sdk-mcp"]).toBeUndefined();
    expect(parsed.mcpServers["other-server"]).toBeDefined();
  });

  it("returns error when bags-sdk-mcp is not in config", () => {
    const existing = JSON.stringify({
      mcpServers: { "other-server": { command: "npx" } },
    });

    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(existing);

    const result = uninstallConfig(TEST_PATH);

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("returns error on malformed JSON", () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue("not json");

    const result = uninstallConfig(TEST_PATH);

    expect(result.success).toBe(false);
    expect(result.error).toContain("invalid JSON");
  });
});

describe("isAlreadyInstalled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when bags-sdk-mcp exists in config", () => {
    const existing = JSON.stringify({
      mcpServers: { "bags-sdk-mcp": { command: "npx" } },
    });

    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(existing);

    expect(isAlreadyInstalled(TEST_PATH)).toBe(true);
  });

  it("returns false when config has no bags-sdk-mcp", () => {
    const existing = JSON.stringify({
      mcpServers: { "other-server": { command: "npx" } },
    });

    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(existing);

    expect(isAlreadyInstalled(TEST_PATH)).toBe(false);
  });

  it("returns false when file does not exist", () => {
    fs.existsSync.mockReturnValue(false);

    expect(isAlreadyInstalled(TEST_PATH)).toBe(false);
  });

  it("returns false on malformed JSON", () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue("broken");

    expect(isAlreadyInstalled(TEST_PATH)).toBe(false);
  });
});
