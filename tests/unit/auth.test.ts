import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, statSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { writeFileSync } from "node:fs";
import { readConfig, writeConfig, deleteConfig, getConfigPath, getLegacyConfigPath } from "../../src/config.js";
import { resolveAuth } from "../../src/auth.js";
import { registerLogin } from "../../src/commands/login.js";
import { registerLogout } from "../../src/commands/logout.js";

let dir: string;
const originalEnv = { ...process.env };

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "upstash-cli-test-"));
  process.env.UPSTASH_CONFIG_HOME = dir;
  process.env.UPSTASH_LEGACY_CONFIG_HOME = dir;
  delete process.env.UPSTASH_EMAIL;
  delete process.env.UPSTASH_API_KEY;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  process.env = { ...originalEnv };
});

describe("config file round-trip", () => {
  it("returns null when the file is missing", () => {
    expect(readConfig()).toBeNull();
  });

  it("writes with 0600 perms and reads back", () => {
    const path = writeConfig({ email: "a@b.com", apiKey: "key-1" });
    expect(path).toBe(getConfigPath());
    expect(readConfig()).toEqual({ email: "a@b.com", apiKey: "key-1" });
    if (process.platform !== "win32") {
      const mode = statSync(path).mode & 0o777;
      expect(mode).toBe(0o600);
    }
    const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, string>;
    expect(raw).toEqual({ email: "a@b.com", api_key: "key-1" });
  });

  it("deleteConfig reports whether it removed a file", () => {
    expect(deleteConfig()).toBe(false);
    writeConfig({ email: "a@b.com", apiKey: "key-1" });
    expect(deleteConfig()).toBe(true);
    expect(existsSync(getConfigPath())).toBe(false);
  });
});

describe("legacy ~/.upstash.json fallback", () => {
  function writeLegacy(body: unknown): void {
    writeFileSync(getLegacyConfigPath(), JSON.stringify(body));
  }

  it("reads the 0.x file (camelCase apiKey) when no new config exists", () => {
    writeLegacy({ email: "legacy@b.com", apiKey: "legacy-key" });
    expect(readConfig()).toEqual({ email: "legacy@b.com", apiKey: "legacy-key" });
  });

  it("prefers the new config over the legacy file", () => {
    writeLegacy({ email: "legacy@b.com", apiKey: "legacy-key" });
    writeConfig({ email: "new@b.com", apiKey: "new-key" });
    expect(readConfig()).toEqual({ email: "new@b.com", apiKey: "new-key" });
  });

  it("ignores a legacy file that is missing a field", () => {
    writeLegacy({ email: "legacy@b.com" });
    expect(readConfig()).toBeNull();
  });
});

describe("resolveAuth precedence", () => {
  it("throws when nothing is configured and mentions `upstash login`", () => {
    expect(() => resolveAuth({})).toThrow(/upstash login/);
  });

  it("falls back to the saved config file", () => {
    writeConfig({ email: "file@b.com", apiKey: "file-key" });
    expect(resolveAuth({})).toEqual({ email: "file@b.com", apiKey: "file-key" });
  });

  it("env vars beat the saved config file", () => {
    writeConfig({ email: "file@b.com", apiKey: "file-key" });
    process.env.UPSTASH_EMAIL = "env@b.com";
    process.env.UPSTASH_API_KEY = "env-key";
    expect(resolveAuth({})).toEqual({ email: "env@b.com", apiKey: "env-key" });
  });

  it("refuses to mix a partial session tier with the saved config", () => {
    writeConfig({ email: "file@b.com", apiKey: "file-key" });
    process.env.UPSTASH_EMAIL = "env@b.com";
    // no UPSTASH_API_KEY — session tier is partial, must not silently borrow from config
    expect(() => resolveAuth({})).toThrow(/incomplete/);
  });

  it("flags beat env vars and the saved config file", () => {
    writeConfig({ email: "file@b.com", apiKey: "file-key" });
    process.env.UPSTASH_EMAIL = "env@b.com";
    process.env.UPSTASH_API_KEY = "env-key";
    expect(resolveAuth({ email: "flag@b.com", apiKey: "flag-key" })).toEqual({
      email: "flag@b.com",
      apiKey: "flag-key",
    });
  });
});

describe("login / logout commands (flag form)", () => {
  function authProgram(): Command {
    return new Command()
      .exitOverride()
      .option("--email <email>", "Upstash email (overrides UPSTASH_EMAIL)")
      .option("--api-key <key>", "Upstash API key (overrides UPSTASH_API_KEY)")
      .configureOutput({ writeOut: () => {}, writeErr: () => {} });
  }

  async function captureStdout(program: Command, argv: string[]): Promise<string> {
    const lines: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => lines.push(args.join(" "));
    try {
      await program.parseAsync(["node", "upstash", ...argv]);
    } finally {
      console.log = origLog;
    }
    return lines.join("\n");
  }

  it("login --email --api-key verifies, then writes the config file and reports the path", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", { status: 200 }),
    );
    try {
      const p = authProgram();
      registerLogin(p);
      const output = await captureStdout(p, ["login", "--email", "cli@b.com", "--api-key", "cli-key"]);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(output).toBe(`Credentials verified and saved to ${getConfigPath()}`);
      expect(readConfig()).toEqual({ email: "cli@b.com", apiKey: "cli-key" });
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("login rejects invalid credentials without writing the config file", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"error":"unauthorized"}', { status: 401 }),
    );
    try {
      const p = authProgram();
      registerLogin(p);
      await expect(
        captureStdout(p, ["login", "--email", "bad@b.com", "--api-key", "bad-key"]),
      ).rejects.toThrow(/Authentication failed/);
      expect(readConfig()).toBeNull();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("logout removes the saved file and reports the path", async () => {
    writeConfig({ email: "a@b.com", apiKey: "key-1" });
    const p = authProgram();
    registerLogout(p);
    const output = await captureStdout(p, ["logout"]);
    expect(output).toBe(`Removed credentials at ${getConfigPath()}`);
    expect(readConfig()).toBeNull();
  });

  it("logout on a clean machine says so without erroring", async () => {
    const p = authProgram();
    registerLogout(p);
    const output = await captureStdout(p, ["logout"]);
    expect(output).toBe(`No saved credentials at ${getConfigPath()}`);
  });
});
