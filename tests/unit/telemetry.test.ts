import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { readConfig, writeConfig, deleteConfig, getConfigPath } from "../../src/config.js";
import { telemetryHeaders, telemetryStatus } from "../../src/telemetry.js";
import { request } from "../../src/client.js";
import { registerTelemetry } from "../../src/commands/telemetry.js";

const auth = { email: "user@example.com", apiKey: "key" };

let dir: string;
const originalEnv = { ...process.env };

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "upstash-cli-telemetry-"));
  process.env.UPSTASH_CONFIG_HOME = dir;
  process.env.UPSTASH_LEGACY_CONFIG_HOME = dir;
  delete process.env.UPSTASH_DISABLE_TELEMETRY;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

async function run(argv: string[]): Promise<string[]> {
  const output: string[] = [];
  const origLog = console.log;
  console.log = (...args: unknown[]) => output.push(args.join(" "));
  try {
    const program = new Command().exitOverride();
    registerTelemetry(program);
    await program.parseAsync(["node", "upstash", ...argv]);
  } finally {
    console.log = origLog;
  }
  return output;
}

describe("telemetryStatus", () => {
  it("is enabled by default", () => {
    expect(telemetryStatus()).toEqual({ enabled: true });
    expect(telemetryHeaders()["Upstash-Telemetry-Sdk"]).toMatch(/^@upstash\/cli@/);
  });

  it("is disabled by UPSTASH_DISABLE_TELEMETRY", () => {
    process.env.UPSTASH_DISABLE_TELEMETRY = "1";
    expect(telemetryStatus()).toEqual({
      enabled: false,
      disabled_by: "UPSTASH_DISABLE_TELEMETRY",
    });
    expect(telemetryHeaders()).toEqual({});
  });

  it.each(["", "0", "false"])("ignores a %s env value", (value) => {
    process.env.UPSTASH_DISABLE_TELEMETRY = value;
    expect(telemetryStatus().enabled).toBe(true);
  });

  it("is disabled by the saved preference", async () => {
    await run(["telemetry", "disable"]);
    expect(telemetryStatus()).toEqual({ enabled: false, disabled_by: getConfigPath() });
    expect(telemetryHeaders()).toEqual({});
  });

  it("sends no telemetry headers on a request when disabled", async () => {
    await run(["telemetry", "disable"]);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await request(auth, "GET", "/v2/redis/databases");

    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(Object.keys(headers).some((key) => key.startsWith("Upstash-Telemetry"))).toBe(false);
    expect(headers.Authorization).toBeTruthy();
  });

  it("re-enables through the command", async () => {
    await run(["telemetry", "disable"]);
    await run(["telemetry", "enable"]);
    expect(telemetryStatus().enabled).toBe(true);
  });

  it("reports an env override as still disabled after enable", async () => {
    process.env.UPSTASH_DISABLE_TELEMETRY = "1";
    const output = await run(["telemetry", "enable"]);
    expect(output.join(" ")).toContain("Still disabled by UPSTASH_DISABLE_TELEMETRY");
  });
});

describe("the telemetry preference and credentials are independent", () => {
  it("survives login", async () => {
    await run(["telemetry", "disable"]);
    writeConfig(auth);
    expect(readConfig()).toEqual(auth);
    expect(telemetryStatus().enabled).toBe(false);
  });

  it("survives logout", async () => {
    writeConfig(auth);
    await run(["telemetry", "disable"]);
    expect(deleteConfig()).toBe(true);
    expect(readConfig()).toBeNull();
    expect(telemetryStatus().enabled).toBe(false);
  });

  it("does not report a logout when only the preference was stored", async () => {
    await run(["telemetry", "disable"]);
    expect(deleteConfig()).toBe(false);
  });

  it("keeps the config file readable only by the owner", async () => {
    await run(["telemetry", "disable"]);
    expect(JSON.parse(readFileSync(getConfigPath(), "utf8"))).toEqual({
      telemetry_disabled: true,
    });
  });
});
