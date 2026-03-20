/** Unit tests for doctor diagnostic checks. */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => "{}"),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, platform: vi.fn(() => actual.platform()), homedir: actual.homedir };
});

vi.mock("node:net", () => ({
  createServer: vi.fn(() => ({
    once: vi.fn(),
    listen: vi.fn((_port: number, _host: string, cb: () => void) => cb()),
    close: vi.fn((cb: () => void) => cb()),
  })),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});

/** Collect all console.log output as one string for assertion. */
function allOutput(): string {
  return mockConsoleLog.mock.calls.map((c) => c.join(" ")).join("\n");
}

describe("runDoctor", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.BAGS_API_KEY = "bfm_test_key_abc123";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 0 when only optional vars are missing (warnings only)", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ result: 312847291 }) });

    const { runDoctor } = await import("../../src/cli/doctor.js");
    const code = await runDoctor();

    // Optional missing vars are warnings, not failures
    expect(code).toBe(0);
    expect(allOutput()).toContain("BAGS_API_KEY");
    expect(allOutput()).toContain("reachable");
  });

  it("flags missing BAGS_API_KEY as a failure", async () => {
    delete process.env.BAGS_API_KEY;
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ result: 1 }) });

    vi.resetModules();
    const { runDoctor } = await import("../../src/cli/doctor.js");
    const code = await runDoctor();

    expect(code).toBe(1);
    expect(allOutput()).toContain("BAGS_API_KEY");
  });

  it("flags invalid API key (401) as a failure", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.includes("token-launch")) {
        return { ok: false, status: 401, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => ({ result: 312847291 }) };
    });

    vi.resetModules();
    const { runDoctor } = await import("../../src/cli/doctor.js");
    const code = await runDoctor();

    expect(code).toBe(1);
    expect(allOutput()).toContain("invalid API key");
  });

  it("handles network timeout gracefully", async () => {
    mockFetch.mockRejectedValue(Object.assign(new Error("abort"), { name: "AbortError" }));

    vi.resetModules();
    const { runDoctor } = await import("../../src/cli/doctor.js");
    const code = await runDoctor();

    expect(code).toBe(1);
    expect(allOutput()).toContain("timeout");
  });

  it("reports server metadata", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ result: 312847291 }) });

    vi.resetModules();
    const { runDoctor } = await import("../../src/cli/doctor.js");
    await runDoctor();

    expect(allOutput()).toContain("46 registered");
    expect(allOutput()).toContain("4 registered");
    expect(allOutput()).toContain("8 registered");
  });
});
