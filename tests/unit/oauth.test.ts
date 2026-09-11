import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import {
  clearOAuth,
  deleteConfig,
  getConfigPath,
  readConfig,
  readOAuth,
  readOAuthClient,
  readTelemetryDisabled,
  writeConfig,
  writeOAuth,
  writeOAuthClient,
  writeTelemetryDisabled,
} from "../../src/config.js";
import { getAccessToken, LOGIN_EXPIRED } from "../../src/oauth/refresh.js";
import { startCallbackServer } from "../../src/oauth/loopback.js";
import { withLock } from "../../src/oauth/lock.js";
import { request, READ_ONLY_LOGIN, TEAM_MANAGEMENT_NEEDS_API_KEY } from "../../src/client.js";
import { registerLogout } from "../../src/commands/logout.js";
import { registerWhoami } from "../../src/commands/whoami.js";

const ISSUER = "https://issuer.test";
const now = () => Math.floor(Date.now() / 1000);

let dir: string;
const originalEnv = { ...process.env };

function tokens(overrides: Partial<Parameters<typeof writeOAuth>[0]> = {}) {
  return { issuer: ISSUER, access_token: "at-0", refresh_token: "rt-0", expires_at: now() + 86400, ...overrides };
}

function client() {
  return { issuer: ISSUER, client_id: "cid", redirect_uri: "http://127.0.0.1/callback", registered_at: now() };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
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

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "upstash-cli-oauth-"));
  process.env.UPSTASH_CONFIG_HOME = dir;
  process.env.UPSTASH_LEGACY_CONFIG_HOME = dir;
  process.env.UPSTASH_OAUTH_ISSUER = ISSUER;
  delete process.env.UPSTASH_EMAIL;
  delete process.env.UPSTASH_API_KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
  process.env = { ...originalEnv };
});

describe("config keeps the fields a write does not touch", () => {
  it("telemetry and client survive credential writes, and files stay 0600", () => {
    writeTelemetryDisabled(true);
    writeOAuthClient(client());
    writeConfig({ email: "a@b.com", apiKey: "k" });
    writeOAuth(tokens());
    expect(readTelemetryDisabled()).toBe(true);
    expect(readOAuthClient()?.client_id).toBe("cid");
    if (process.platform !== "win32") expect(statSync(getConfigPath()).mode & 0o777).toBe(0o600);
    expect(existsSync(`${getConfigPath()}.tmp`)).toBe(false);
  });

  it("an OAuth login replaces an API key login and vice versa", () => {
    writeConfig({ email: "a@b.com", apiKey: "k" });
    writeOAuth(tokens());
    expect(readConfig()).toEqual({ kind: "oauth" });
    const raw = JSON.parse(readFileSync(getConfigPath(), "utf8")) as Record<string, unknown>;
    expect(raw.email).toBeUndefined();
    writeConfig({ email: "c@d.com", apiKey: "k2" });
    expect(readOAuth()).toBeNull();
    expect(readConfig()).toEqual({ kind: "api-key", email: "c@d.com", apiKey: "k2" });
  });

  it("deleteConfig keeps the registered client and telemetry preference", () => {
    writeOAuthClient(client());
    writeTelemetryDisabled(true);
    writeOAuth(tokens());
    expect(deleteConfig()).toBe(true);
    expect(readOAuth()).toBeNull();
    expect(readOAuthClient()?.client_id).toBe("cid");
    expect(readTelemetryDisabled()).toBe(true);
    expect(deleteConfig()).toBe(false);
  });
});

describe("callback server", () => {
  async function hit(redirectUri: string, params: Record<string, string>): Promise<number> {
    const url = new URL(redirectUri);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return (await fetch(url)).status;
  }

  it("accepts a matching state and iss and yields the code", async () => {
    const server = await startCallbackServer({ state: "s1", issuer: ISSUER }, 5000);
    expect(server.redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
    expect(await hit(server.redirectUri.replace("/callback", "/favicon.ico"), {})).toBe(404);
    expect(await hit(server.redirectUri, { state: "s1", iss: ISSUER, code: "abc" })).toBe(200);
    await expect(server.code).resolves.toBe("abc");
    server.close();
  });

  it("rejects a wrong state without settling, then a wrong iss with a clear error", async () => {
    const server = await startCallbackServer({ state: "s1", issuer: ISSUER }, 5000);
    expect(await hit(server.redirectUri, { state: "other", code: "x" })).toBe(400);
    expect(await hit(server.redirectUri, { state: "s1", iss: "https://evil.test", code: "x" })).toBe(400);
    await expect(server.code).rejects.toThrow(/evil\.test/);
    server.close();
  });

  it("surfaces an error parameter", async () => {
    const server = await startCallbackServer({ state: "s1", issuer: ISSUER }, 5000);
    await hit(server.redirectUri, { state: "s1", error: "access_denied", error_description: "User denied" });
    await expect(server.code).rejects.toThrow(/User denied/);
    server.close();
  });
});

describe("refresh", () => {
  beforeEach(() => writeOAuthClient(client()));

  it("uses a fresh token without a network call", async () => {
    writeOAuth(tokens());
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await getAccessToken()).toBe("at-0");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refreshes a near-expiry token once and stores the rotated pair", async () => {
    writeOAuth(tokens({ expires_at: now() + 60 }));
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ access_token: "at-1", refresh_token: "rt-1", expires_in: 86400 }));
    expect(await getAccessToken()).toBe("at-1");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = fetchSpy.mock.calls[0]![1]!.body as URLSearchParams;
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("rt-0");
    expect(readOAuth()?.refresh_token).toBe("rt-1");
    expect(existsSync(`${getConfigPath()}.lock`)).toBe(false);
  });

  it("two concurrent refreshes hit the token endpoint once and agree on the token", async () => {
    writeOAuth(tokens({ expires_at: now() + 60 }));
    let calls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 150));
      return json({ access_token: `at-${calls}`, refresh_token: `rt-${calls}`, expires_in: 86400 });
    });
    const [a, b] = await Promise.all([getAccessToken(), getAccessToken()]);
    expect(calls).toBe(1);
    expect(a).toBe("at-1");
    expect(b).toBe("at-1");
  });

  it("keeps the old refresh token when the response omits one", async () => {
    writeOAuth(tokens({ expires_at: now() + 60 }));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ access_token: "at-1", expires_in: 3600 }));
    await getAccessToken();
    expect(readOAuth()?.refresh_token).toBe("rt-0");
  });

  it("invalid_grant ends the session but keeps the client; a 5xx keeps everything", async () => {
    writeOAuth(tokens({ expires_at: now() + 60 }));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ error: "invalid_grant" }, 400));
    await expect(getAccessToken()).rejects.toThrow(LOGIN_EXPIRED);
    expect(readOAuth()).toBeNull();
    expect(readOAuthClient()?.client_id).toBe("cid");

    writeOAuth(tokens({ expires_at: now() + 60 }));
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("down", { status: 503 }));
    await expect(getAccessToken()).rejects.toThrow(/server_error/);
    expect(readOAuth()?.refresh_token).toBe("rt-0");
  });

  it("clears a stale lock left by a dead process", async () => {
    const lock = join(dir, "stale.lock");
    writeFileSync(lock, "1");
    const old = Date.now() / 1000 - 120;
    const { utimesSync } = await import("node:fs");
    utimesSync(lock, old, old);
    expect(await withLock(lock, async () => "ran")).toBe("ran");
    expect(existsSync(lock)).toBe(false);
  });
});

describe("requests with a browser login", () => {
  beforeEach(() => {
    writeOAuthClient(client());
    writeOAuth(tokens());
  });

  it("sends a Bearer header", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json([]));
    await request({ kind: "oauth" }, "GET", "/v2/redis/databases");
    const headers = fetchSpy.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer at-0");
  });

  it("refreshes and retries once on a 401", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(json({ access_token: "at-1", refresh_token: "rt-1", expires_in: 86400 }))
      .mockResolvedValueOnce(json([{ database_id: "db" }]));
    const result = await request<unknown[]>({ kind: "oauth" }, "GET", "/v2/redis/databases");
    expect(result).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect((fetchSpy.mock.calls[2]![1]!.headers as Record<string, string>).Authorization).toBe("Bearer at-1");
  });

  it("explains 403s on team management and read-only grants", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ error: "forbidden" }, 403));
    await expect(request({ kind: "oauth" }, "POST", "/v2/team", {})).rejects.toThrow(TEAM_MANAGEMENT_NEEDS_API_KEY);

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ error: "forbidden" }, 403))
      .mockResolvedValueOnce(json({ email: "a@b.com", read_only: true }));
    await expect(request({ kind: "oauth" }, "POST", "/v2/redis/database", {})).rejects.toThrow(READ_ONLY_LOGIN);
  });
});

describe("logout and whoami with a browser login", () => {
  function program(): Command {
    return new Command().exitOverride().configureOutput({ writeOut: () => {}, writeErr: () => {} });
  }

  it("logout revokes the refresh token, then removes it locally even if revocation fails", async () => {
    writeOAuthClient(client());
    writeOAuth(tokens());
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 200 }));
    const p = program();
    registerLogout(p);
    const output = await captureStdout(p, ["logout"]);
    const body = fetchSpy.mock.calls[0]![1]!.body as URLSearchParams;
    expect(String(fetchSpy.mock.calls[0]![0])).toBe(`${ISSUER}/oauth/token/revoke`);
    expect(body.get("token_type_hint")).toBe("refresh_token");
    expect(output).toContain(`Removed credentials at ${getConfigPath()}`);
    expect(output).toContain("oauth-clients");
    expect(readOAuth()).toBeNull();

    writeOAuth(tokens());
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const p2 = program();
    registerLogout(p2);
    await captureStdout(p2, ["logout"]);
    expect(String(stderr.mock.calls[0]![0])).toMatch(/could not revoke/);
    expect(readOAuth()).toBeNull();
  });

  it("whoami reports the grant for a browser login and the source for an API key", async () => {
    writeOAuthClient(client());
    writeOAuth(tokens());
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ email: "a@b.com", team_id: "t1", team_role: "owner", read_only: true }));
    const p = program();
    registerWhoami(p);
    expect(JSON.parse(await captureStdout(p, ["whoami"]))).toEqual({
      auth: "oauth",
      source: "config",
      email: "a@b.com",
      team_id: "t1",
      team_role: "owner",
      read_only: true,
    });

    clearOAuth();
    process.env.UPSTASH_EMAIL = "env@b.com";
    process.env.UPSTASH_API_KEY = "k";
    const p2 = program();
    registerWhoami(p2);
    expect(JSON.parse(await captureStdout(p2, ["whoami"]))).toEqual({ auth: "api-key", source: "env", email: "env@b.com" });
  });
});
