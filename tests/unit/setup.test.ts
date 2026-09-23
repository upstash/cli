import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { registerSetup, setRunner } from "../../src/commands/setup.js";
import { runCommand } from "../../src/setup/plugins.js";
import { parseTar, stripTopDir } from "../../src/setup/repo.js";
import { mergeServerEntry, upsertTomlTable, buildTomlTable } from "../../src/setup/mcp-config.js";

// --- a tiny tar writer, so the fixtures need no binaries ---------------------

function header(name: string, size: number, type: string): Buffer {
  const h = Buffer.alloc(512);
  h.write(name.slice(0, 100), 0);
  h.write("0000644\0", 100);
  h.write(size.toString(8).padStart(11, "0") + "\0", 124);
  h.write(type, 156);
  h.write("ustar\0", 257);
  return h;
}

function pad(buf: Buffer): Buffer {
  const rest = buf.length % 512;
  return rest === 0 ? buf : Buffer.concat([buf, Buffer.alloc(512 - rest)]);
}

function tar(files: Record<string, string>, opts: { paxFor?: string } = {}): Buffer {
  const parts: Buffer[] = [header("pax_global_header", 0, "g")];
  for (const [name, text] of Object.entries(files)) {
    const body = Buffer.from(text);
    if (name === opts.paxFor) {
      const rec = ` path=${name}\n`;
      const len = String(rec.length + String(rec.length).length);
      const pax = Buffer.from(`${len}${rec}`);
      parts.push(header("PaxHeader", pax.length, "x"), pad(pax));
      parts.push(header("truncated", body.length, "0"), pad(body));
    } else {
      parts.push(header(name, body.length, "0"), pad(body));
    }
  }
  parts.push(Buffer.alloc(1024));
  return Buffer.concat(parts);
}

const REPO = {
  "skills-main/skills/upstash/SKILL.md": "---\nname: upstash\n---\n",
  "skills-main/skills/upstash/upstash-redis-js/overview.md": "redis",
  "skills-main/skills/upstash-redis-js/SKILL.md": "redis source",
  "skills-main/.cursor-plugin/plugin.json": '{"name":"upstash"}',
  "skills-main/assets/icon.png": "png",
  "skills-main/README.md": "readme",
};

// --- harness ---------------------------------------------------------------

let home: string;
let calls: string[][];
const origHome = process.env.HOME;
const origCwd = process.cwd();

function program(): Command {
  const p = new Command()
    .exitOverride()
    .option("--email <email>")
    .option("--api-key <key>");
  registerSetup(p);
  return p;
}

async function run(argv: string[]): Promise<string> {
  const out: string[] = [];
  const orig = console.log;
  console.log = (...args: unknown[]) => out.push(args.join(" "));
  try {
    await program().parseAsync(["node", "upstash", "setup", ...argv]);
  } finally {
    console.log = orig;
  }
  return out.join("\n");
}

async function runJson(argv: string[]): Promise<{ results: Array<{ agent: string; method: string; ok: boolean; notes: string[] }> }> {
  return JSON.parse(await run([...argv, "--json"]));
}

const read = (...p: string[]): string => readFileSync(join(home, ...p), "utf8");
const readJson = (...p: string[]): Record<string, any> => JSON.parse(read(...p));

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "upstash-setup-"));
  process.env.HOME = home;
  delete process.env.CLAUDE_CONFIG_DIR;
  delete process.env.UPSTASH_EMAIL;
  delete process.env.UPSTASH_API_KEY;
  calls = [];
  setRunner(async (bin, args) => {
    calls.push([bin, ...args]);
    return { ok: true, missing: false, output: "" };
  });
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(gzipSync(tar(REPO))));
});

afterEach(() => {
  vi.restoreAllMocks();
  setRunner(runCommand);
  process.chdir(origCwd);
  process.env.HOME = origHome;
  process.exitCode = 0;
  rmSync(home, { recursive: true, force: true });
});

// --- pure helpers ----------------------------------------------------------

describe("tar reader", () => {
  it("reads regular files, honors pax paths, and strips the top directory", () => {
    const long = `skills-main/${"a/".repeat(60)}deep.md`;
    const files = stripTopDir(parseTar(tar({ ...REPO, [long]: "deep" }, { paxFor: long })));
    expect(files.get("skills/upstash/SKILL.md")?.toString()).toBe("---\nname: upstash\n---\n");
    expect(files.get(long.slice("skills-main/".length))?.toString()).toBe("deep");
    expect(files.has("pax_global_header")).toBe(false);
  });
});

describe("config merging", () => {
  it("keeps other JSON servers and reports a replaced entry", () => {
    const first = mergeServerEntry({ mcpServers: { other: { url: "x" } }, theme: "dark" }, "mcpServers", "upstash", { url: "u" });
    expect(first.replaced).toBe(false);
    expect(first.config).toEqual({ mcpServers: { other: { url: "x" }, upstash: { url: "u" } }, theme: "dark" });
    expect(mergeServerEntry(first.config, "mcpServers", "upstash", { url: "v" }).replaced).toBe(true);
  });

  it("replaces a TOML table with its sub-tables and leaves neighbours alone", () => {
    const existing = [
      "model = \"o3\"",
      "",
      "[mcp_servers.upstash]",
      "url = \"old\"",
      "",
      "[mcp_servers.upstash.http_headers]",
      "Authorization = \"Bearer old\"",
      "",
      "[mcp_servers.other]",
      "url = \"y\"",
      "",
    ].join("\n");
    const block = buildTomlTable("mcp_servers.upstash", { url: "new" });
    const { content, replaced } = upsertTomlTable(existing, "mcp_servers.upstash", block);
    expect(replaced).toBe(true);
    expect(content).toBe('model = "o3"\n\n[mcp_servers.upstash]\nurl = "new"\n\n[mcp_servers.other]\nurl = "y"\n');
  });

  it("appends a TOML table to a file that lacks it", () => {
    const block = buildTomlTable("mcp_servers.upstash", { url: "u", http_headers: { Authorization: "Bearer t" } });
    const { content, replaced } = upsertTomlTable('model = "o3"\n', "mcp_servers.upstash", block);
    expect(replaced).toBe(false);
    expect(content).toBe(
      'model = "o3"\n\n[mcp_servers.upstash]\nurl = "u"\n\n[mcp_servers.upstash.http_headers]\nAuthorization = "Bearer t"\n',
    );
  });
});

// --- the command -----------------------------------------------------------

describe("setup", () => {
  it("installs plugins through the agent CLIs and falls back to MCP + skill elsewhere", async () => {
    const { results } = await runJson(["--claude", "--codex", "--cursor", "--opencode"]);
    expect(results.map((r) => [r.agent, r.method, r.ok])).toEqual([
      ["claude", "plugin", true],
      ["codex", "plugin", true],
      ["cursor", "plugin", true],
      ["opencode", "mcp", true],
    ]);
    expect(calls).toContainEqual(["claude", "plugin", "marketplace", "add", "upstash/skills", "--scope", "user"]);
    expect(calls).toContainEqual(["claude", "plugin", "install", "upstash@upstash", "--scope", "user"]);
    expect(calls).toContainEqual(["codex", "plugin", "marketplace", "add", "upstash/skills"]);
    expect(calls).toContainEqual(["codex", "plugin", "add", "upstash@upstash"]);

    const cursor = join(home, ".cursor", "plugins", "local", "upstash");
    expect(readFileSync(join(cursor, ".cursor-plugin", "plugin.json"), "utf8")).toBe('{"name":"upstash"}');
    expect(existsSync(join(cursor, "skills", "upstash-redis-js", "SKILL.md"))).toBe(true);
    expect(existsSync(join(cursor, "README.md"))).toBe(false);

    expect(readJson(".config", "opencode", "opencode.json").mcp.upstash).toEqual({
      type: "remote",
      url: "https://mcp.upstash.com/mcp",
      enabled: true,
    });
    expect(read(".config", "opencode", "skills", "upstash", "upstash-redis-js", "overview.md")).toBe("redis");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to MCP + skill when the agent CLI is missing", async () => {
    setRunner(async (bin) => ({ ok: false, missing: true, output: `${bin} not found on PATH` }));
    const { results } = await runJson(["--claude"]);
    expect(results[0]).toMatchObject({ agent: "claude", method: "mcp", ok: true });
    expect(results[0]!.notes[0]).toContain("`claude` not found on PATH");
    expect(readJson(".claude.json").mcpServers.upstash).toEqual({ type: "http", url: "https://mcp.upstash.com/mcp" });
    expect(read(".claude", "skills", "upstash", "SKILL.md")).toContain("name: upstash");
  });

  it("fails instead of falling back with --mode plugin", async () => {
    setRunner(async () => ({ ok: false, missing: false, output: "boom" }));
    const { results } = await runJson(["--codex", "--mode", "plugin"]);
    expect(results[0]).toMatchObject({ method: "plugin", ok: false });
    expect(process.exitCode).toBe(1);
    expect(existsSync(join(home, ".codex", "config.toml"))).toBe(false);
  });

  it("writes an API-key header when credentials are passed, bypassing OAuth-only plugins", async () => {
    mkdirSync(join(home, ".codex"), { recursive: true });
    writeFileSync(join(home, ".codex", "config.toml"), '[mcp_servers.other]\nurl = "y"\n');
    const { results } = await runJson(["--codex", "--cursor", "--email", "me@x.com", "--api-key", "sk"]);
    expect(results.map((r) => r.method)).toEqual(["mcp", "mcp"]);
    expect(results[0]!.notes[0]).toContain("OAuth only");
    expect(calls).toEqual([]);
    expect(read(".codex", "config.toml")).toBe(
      '[mcp_servers.other]\nurl = "y"\n\n[mcp_servers.upstash]\nurl = "https://mcp.upstash.com/mcp"\n\n[mcp_servers.upstash.http_headers]\nAuthorization = "Bearer me@x.com:sk"\n',
    );
    expect(readJson(".cursor", "mcp.json").mcpServers.upstash.headers).toEqual({ Authorization: "Bearer me@x.com:sk" });
    if (process.platform !== "win32") {
      expect(statSync(join(home, ".cursor", "mcp.json")).mode & 0o777).toBe(0o600);
    }
  });

  it("sets up detected agents with --yes", async () => {
    mkdirSync(join(home, ".gemini"));
    mkdirSync(join(home, ".copilot"));
    const { results } = await runJson(["--yes"]);
    expect(results.map((r) => r.agent)).toEqual(["gemini", "copilot"]);
    expect(calls).toContainEqual(["gemini", "extensions", "install", "https://github.com/upstash/skills", "--consent"]);
  });

  it("errors when nothing is selected or detected", async () => {
    await expect(run(["--yes"])).rejects.toThrow(/No agents selected/);
  });

  it("configures the project with --project, keeping Claude's project-scoped plugin", async () => {
    const project = join(home, "proj");
    mkdirSync(project);
    process.chdir(project);
    const { results } = await runJson(["--claude", "--cursor", "--project"]);
    expect(results.map((r) => [r.agent, r.method])).toEqual([
      ["claude", "plugin"],
      ["cursor", "mcp"],
    ]);
    expect(calls).toContainEqual(["claude", "plugin", "install", "upstash@upstash", "--scope", "project"]);
    expect(readJson("proj", ".cursor", "mcp.json").mcpServers.upstash).toEqual({ url: "https://mcp.upstash.com/mcp" });
    expect(existsSync(join(project, ".cursor", "skills", "upstash", "SKILL.md"))).toBe(true);
  });

  it("replaces the skill folder so files removed upstream do not linger", async () => {
    const stale = join(home, ".claude", "skills", "upstash", "stale.md");
    mkdirSync(join(home, ".claude", "skills", "upstash"), { recursive: true });
    writeFileSync(stale, "old");
    await runJson(["--claude", "--mode", "mcp"]);
    expect(existsSync(stale)).toBe(false);
  });

  it("refuses to overwrite an unreadable JSON config", async () => {
    mkdirSync(join(home, ".cursor"));
    writeFileSync(join(home, ".cursor", "mcp.json"), "{nope");
    const { results } = await runJson(["--cursor", "--mode", "mcp"]);
    expect(results[0]!.ok).toBe(false);
    expect(read(".cursor", "mcp.json")).toBe("{nope");
  });

  it("changes nothing and downloads nothing on --dry-run", async () => {
    const out = await run(["--claude", "--opencode", "--dry-run"]);
    expect(out).toContain("Dry run");
    expect(calls).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
    expect(existsSync(join(home, ".config"))).toBe(false);
  });

  it("warns when switching modes would leave two upstash servers", async () => {
    mkdirSync(join(home, ".cursor", "plugins", "local", "upstash"), { recursive: true });
    const { results } = await runJson(["--cursor", "--mode", "mcp"]);
    expect(results[0]!.notes.join(" ")).toMatch(/plugin is also installed/);

    const again = await runJson(["--cursor"]);
    expect(again.results[0]!.notes.join(" ")).toMatch(/also declares an "upstash" MCP server/);
  });
});
