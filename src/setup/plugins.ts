import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { PLUGIN_ID, SKILLS_REPO, type PluginKind, type Scope } from "./agents.js";
import { subtree, writeTree, type RepoFiles } from "./repo.js";

export type StepStatus = "done" | "planned" | "failed";

export interface Step {
  label: string;
  status: StepStatus;
  path?: string;
  detail?: string;
}

export interface PluginResult {
  ok: boolean;
  /** The agent's CLI binary, when it is not on PATH and there was nothing to call. */
  missing?: string;
  steps: Step[];
  notes: string[];
}

interface RunResult {
  ok: boolean;
  missing: boolean;
  output: string;
}

export type Runner = (bin: string, args: string[]) => Promise<RunResult>;

export const runCommand: Runner = (bin, args) =>
  new Promise((resolve) => {
    execFile(
      bin,
      args,
      // Windows ships these CLIs as .cmd shims, which only resolve through a shell.
      { timeout: 180_000, maxBuffer: 10 * 1024 * 1024, shell: process.platform === "win32" },
      (err, stdout, stderr) => {
        const output = `${stdout ?? ""}${stderr ?? ""}`.trim();
        if (err && (err as NodeJS.ErrnoException).code === "ENOENT") {
          resolve({ ok: false, missing: true, output: `${bin} not found on PATH` });
          return;
        }
        resolve({ ok: !err, missing: false, output: output || (err ? err.message : "") });
      },
    );
  });

/** Last meaningful line of CLI output, for a one-line failure reason. */
function reason(output: string): string {
  const lines = output.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("WARNING"));
  return lines.at(-1) ?? "unknown error";
}

function planned(label: string): Step {
  return { label, status: "planned" };
}

export interface PluginContext {
  scope: Scope;
  ref: string;
  dryRun: boolean;
  run: Runner;
  /** Lazily downloads upstash/skills; only the Cursor installer needs the files. */
  repo: () => Promise<RepoFiles>;
}

/** Runs `add`, then `install`, through an agent's own plugin CLI. */
async function viaCli(
  ctx: PluginContext,
  bin: string,
  marketplace: { add: string[]; refresh: string[] },
  install: string[],
  installLabel: string,
): Promise<PluginResult> {
  const addLabel = `Marketplace ${SKILLS_REPO}`;
  if (ctx.dryRun) return { ok: true, steps: [planned(addLabel), planned(installLabel)], notes: [] };

  const add = await ctx.run(bin, marketplace.add);
  if (add.missing) return { ok: false, missing: bin, steps: [], notes: [] };
  if (!add.ok) {
    return { ok: false, steps: [{ label: addLabel, status: "failed", detail: reason(add.output) }], notes: [] };
  }
  // `add` is a no-op when the marketplace already exists; refresh so a rerun
  // picks up the latest plugin. Best-effort: an old CLI may lack the command.
  await ctx.run(bin, marketplace.refresh);

  const res = await ctx.run(bin, install);
  const steps: Step[] = [
    { label: addLabel, status: "done" },
    res.ok
      ? { label: installLabel, status: "done" }
      : { label: installLabel, status: "failed", detail: reason(res.output) },
  ];
  return { ok: res.ok, steps, notes: [] };
}

async function claude(ctx: PluginContext): Promise<PluginResult> {
  const scope = ctx.scope === "project" ? "project" : "user";
  const result = await viaCli(
    ctx,
    "claude",
    {
      add: ["plugin", "marketplace", "add", SKILLS_REPO, "--scope", scope],
      refresh: ["plugin", "marketplace", "update", "upstash"],
    },
    ["plugin", "install", PLUGIN_ID, "--scope", scope],
    `Plugin ${PLUGIN_ID} (${scope} scope)`,
  );
  // `install` reports success without upgrading an existing install.
  if (result.ok && !ctx.dryRun) await ctx.run("claude", ["plugin", "update", PLUGIN_ID, "--scope", scope]);
  return result;
}

function codex(ctx: PluginContext): Promise<PluginResult> {
  return viaCli(
    ctx,
    "codex",
    {
      add: ["plugin", "marketplace", "add", SKILLS_REPO],
      refresh: ["plugin", "marketplace", "upgrade", "upstash"],
    },
    ["plugin", "add", PLUGIN_ID],
    `Plugin ${PLUGIN_ID}`,
  );
}

async function gemini(ctx: PluginContext): Promise<PluginResult> {
  const label = "Extension upstash";
  if (ctx.dryRun) return { ok: true, steps: [planned(label)], notes: [] };
  const args = ["extensions", "install", `https://github.com/${SKILLS_REPO}`, "--consent"];
  if (ctx.ref !== "main") args.push("--ref", ctx.ref);
  let res = await ctx.run("gemini", args);
  if (res.missing) return { ok: false, missing: "gemini", steps: [], notes: [] };
  if (!res.ok && /already installed/i.test(res.output)) {
    res = await ctx.run("gemini", ["extensions", "update", "upstash"]);
  }
  return {
    ok: res.ok,
    steps: [res.ok ? { label, status: "done" } : { label, status: "failed", detail: reason(res.output) }],
    notes: [],
  };
}

export function cursorPluginDir(): string {
  return join(homedir(), ".cursor", "plugins", "local", "upstash");
}

/**
 * Cursor has no plugin CLI, and the Upstash plugin is not in its marketplace
 * yet, so this installs it as a local plugin: the same manifest, skills and
 * assets the marketplace would fetch, under ~/.cursor/plugins/local/.
 */
async function cursor(ctx: PluginContext): Promise<PluginResult> {
  const dest = cursorPluginDir();
  const label = "Local plugin upstash";
  const notes = ["Reload Cursor (Developer: Reload Window) to load the plugin."];
  if (ctx.dryRun) return { ok: true, steps: [{ ...planned(label), path: dest }], notes };
  try {
    const repo = await ctx.repo();
    const files: RepoFiles = new Map();
    for (const dir of [".cursor-plugin", "skills", "assets"]) {
      for (const [rel, content] of subtree(repo, dir)) files.set(`${dir}/${rel}`, content);
    }
    if (!files.has(".cursor-plugin/plugin.json")) {
      throw new Error(`${SKILLS_REPO}@${ctx.ref} has no .cursor-plugin/plugin.json`);
    }
    await writeTree(files, dest);
    return { ok: true, steps: [{ label, status: "done", path: dest }], notes };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, steps: [{ label, status: "failed", path: dest, detail }], notes: [] };
  }
}

const INSTALLERS: Record<PluginKind, (ctx: PluginContext) => Promise<PluginResult>> = {
  claude,
  codex,
  cursor,
  gemini,
};

export function installPlugin(kind: PluginKind, ctx: PluginContext): Promise<PluginResult> {
  return INSTALLERS[kind](ctx);
}

async function fileIncludes(path: string, needle: string): Promise<boolean> {
  try {
    return (await readFile(path, "utf8")).includes(needle);
  } catch {
    return false;
  }
}

/** Best-effort check for a user-level Upstash plugin, to warn about a second MCP server. */
export async function isPluginInstalled(kind: PluginKind): Promise<boolean> {
  const claudeDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
  switch (kind) {
    case "claude":
      return fileIncludes(join(claudeDir, "plugins", "installed_plugins.json"), `"${PLUGIN_ID}"`);
    case "codex":
      return fileIncludes(join(homedir(), ".codex", "config.toml"), `[plugins."${PLUGIN_ID}"]`);
    case "cursor":
      return access(cursorPluginDir()).then(() => true, () => false);
    case "gemini":
      return access(join(homedir(), ".gemini", "extensions", "upstash")).then(() => true, () => false);
  }
}
