/** Unit tests for MCP client detection across platforms. */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { join } from "node:path";
import { homedir } from "node:os";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
}));

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    platform: vi.fn(() => actual.platform()),
    homedir: actual.homedir,
  };
});

const mockExistsSync = vi.mocked((await import("node:fs")).existsSync);
const mockPlatform = vi.mocked((await import("node:os")).platform);
const { detectClients } = await import("../../src/setup/detect.js");

describe("detectClients", () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockExistsSync.mockReturnValue(false);
    mockPlatform.mockReset();
  });

  it("returns empty array when no clients are found", () => {
    mockPlatform.mockReturnValue("darwin");
    expect(detectClients()).toEqual([]);
  });

  it("detects Claude Desktop on macOS", () => {
    const home = homedir();
    const expectedPath = join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");

    mockPlatform.mockReturnValue("darwin");
    mockExistsSync.mockImplementation((p: unknown) => String(p) === expectedPath);

    const clients = detectClients();
    const claude = clients.find((c) => c.id === "claude-desktop");

    expect(claude).toBeDefined();
    expect(claude!.configPath).toBe(expectedPath);
  });

  it("detects Claude Desktop on Windows", () => {
    const appdata = process.env.APPDATA;
    if (!appdata) return;

    const expectedPath = join(appdata, "Claude", "claude_desktop_config.json");

    mockPlatform.mockReturnValue("win32");
    mockExistsSync.mockImplementation((p: unknown) => String(p) === expectedPath);

    const clients = detectClients();
    const claude = clients.find((c) => c.id === "claude-desktop");

    expect(claude).toBeDefined();
    expect(claude!.configPath).toBe(expectedPath);
  });

  it("detects Claude Desktop on Linux", () => {
    const home = homedir();
    const expectedPath = join(home, ".config", "Claude", "claude_desktop_config.json");

    mockPlatform.mockReturnValue("linux");
    mockExistsSync.mockImplementation((p: unknown) => String(p) === expectedPath);

    const clients = detectClients();
    const claude = clients.find((c) => c.id === "claude-desktop");

    expect(claude).toBeDefined();
    expect(claude!.configPath).toBe(expectedPath);
  });

  it("detects Cursor config in cwd", () => {
    const expectedPath = join(process.cwd(), ".cursor", "mcp.json");

    mockPlatform.mockReturnValue("win32");
    mockExistsSync.mockImplementation((p: unknown) => String(p) === expectedPath);

    const clients = detectClients();
    const cursor = clients.find((c) => c.id === "cursor");

    expect(cursor).toBeDefined();
    expect(cursor!.configPath).toBe(expectedPath);
  });

  it("detects Claude Code .mcp.json in cwd", () => {
    const expectedPath = join(process.cwd(), ".mcp.json");

    mockPlatform.mockReturnValue("win32");
    mockExistsSync.mockImplementation((p: unknown) => String(p) === expectedPath);

    const clients = detectClients();
    const cc = clients.find((c) => c.id === "claude-code");

    expect(cc).toBeDefined();
    expect(cc!.configPath).toBe(expectedPath);
  });

  it("detects multiple clients simultaneously", () => {
    const cwdMcp = join(process.cwd(), ".mcp.json");
    const cwdCursor = join(process.cwd(), ".cursor", "mcp.json");

    mockPlatform.mockReturnValue("win32");
    mockExistsSync.mockImplementation((p: unknown) => {
      const s = String(p);
      return s === cwdMcp || s === cwdCursor;
    });

    const clients = detectClients();

    expect(clients.length).toBeGreaterThanOrEqual(2);
    expect(clients.some((c) => c.id === "cursor")).toBe(true);
    expect(clients.some((c) => c.id === "claude-code")).toBe(true);
  });
});
