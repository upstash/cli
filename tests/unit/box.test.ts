import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { writeConfig, writeOAuth, writeOAuthClient } from "../../src/config.js";
import { BOX_NEEDS_OAUTH_OR_BOX_KEY, registerBox } from "../../src/commands/box.js";

const ISSUER = "https://issuer.test";
const now = () => Math.floor(Date.now() / 1000);

let dir: string;
const originalEnv = { ...process.env };

function program(): Command {
  const p = new Command()
    .exitOverride()
    .option("--email <email>")
    .option("--api-key <key>")
    .configureOutput({ writeOut: () => {}, writeErr: () => {} });
  registerBox(p);
  return p;
}

async function run(argv: string[]): Promise<void> {
  const origLog = console.log;
  const origError = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    await program().parseAsync(["node", "upstash", ...argv]);
  } finally {
    console.log = origLog;
    console.error = origError;
  }
}

const okList = () => Promise.resolve(new Response("[]", { status: 200 }));

function authHeaderOf(): Record<string, string> {
  return vi.mocked(fetch).mock.calls[0]![1]!.headers as Record<string, string>;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "upstash-cli-box-"));
  process.env.UPSTASH_CONFIG_HOME = dir;
  process.env.UPSTASH_LEGACY_CONFIG_HOME = dir;
  delete process.env.UPSTASH_EMAIL;
  delete process.env.UPSTASH_API_KEY;
  delete process.env.UPSTASH_BOX_API_KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
  rmSync(dir, { recursive: true, force: true });
  process.env = { ...originalEnv };
});

describe("upstash box", () => {
  it("hands the OAuth access token to the box commands as a Bearer credential", async () => {
    writeOAuthClient({ issuer: ISSUER, client_id: "cid", redirect_uri: "http://127.0.0.1/callback", registered_at: now() });
    writeOAuth({ issuer: ISSUER, access_token: "a.b.c", refresh_token: "rt", expires_at: now() + 86400 });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(okList);

    await run(["box", "list", "--json"]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(authHeaderOf().Authorization).toBe("Bearer a.b.c");
  });

  it("refuses a Developer API key login, and no login at all, with one message", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(run(["box", "list"])).rejects.toThrow(BOX_NEEDS_OAUTH_OR_BOX_KEY);
    writeConfig({ email: "a@b.com", apiKey: "k" });
    await expect(run(["box", "list"])).rejects.toThrow(BOX_NEEDS_OAUTH_OR_BOX_KEY);
    await expect(run(["box", "list", "--email", "a@b.com", "--api-key", "k"])).rejects.toThrow(
      BOX_NEEDS_OAUTH_OR_BOX_KEY,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("leaves a Box API key from the environment or --token to the box commands", async () => {
    writeConfig({ email: "a@b.com", apiKey: "k" });
    process.env.UPSTASH_BOX_API_KEY = "abx_env";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(okList);

    await run(["box", "list", "--json"]);
    expect(authHeaderOf()["X-Box-Api-Key"]).toBe("abx_env");

    delete process.env.UPSTASH_BOX_API_KEY;
    fetchSpy.mockClear();
    await run(["box", "list", "--json", "--token", "abx_flag"]);
    expect(authHeaderOf()["X-Box-Api-Key"]).toBe("abx_flag");
  });
});
