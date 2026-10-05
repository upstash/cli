import { Command } from "commander";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { plainError } from "../output.js";
import {
  AGENT_NAMES,
  SKILL_NAME,
  getAgent,
  type AgentName,
  type Scope,
} from "../setup/agents.js";
import { hasMcpEntry, resolveMcpPath, writeMcpEntry } from "../setup/mcp-config.js";
import { installPlugin, isPluginInstalled, runCommand, type Runner, type Step } from "../setup/plugins.js";
import { fetchSkillsRepo, subtree, writeTree, type RepoFiles } from "../setup/repo.js";
import * as ui from "../setup/ui.js";

type Mode = "auto" | "plugin" | "mcp";
type Method = "plugin" | "mcp";

interface SetupFlags extends Partial<Record<AgentName, boolean>> {
  mode: string;
  project?: boolean;
  yes?: boolean;
  dryRun?: boolean;
  json?: boolean;
}

export interface AgentResult {
  agent: AgentName;
  name: string;
  method: Method;
  ok: boolean;
  steps: Step[];
  notes: string[];
}

const METHOD_LABEL: Record<Method, string> = { plugin: "plugin", mcp: "MCP + skill" };

/** Swappable in tests so plugin installs do not shell out to real agent CLIs. */
let runner: Runner = runCommand;
export function setRunner(next: Runner): void {
  runner = next;
}

export function registerSetup(program: Command): void {
  const command = program
    .command("setup")
    .description(
      "Connect AI coding agents to Upstash. Installs the Upstash plugin (MCP server + skills) where the agent supports plugins — Claude Code, Codex, Cursor, Gemini CLI — and otherwise writes the remote MCP server into the agent's config and installs the Upstash skill.",
    );

  for (const name of AGENT_NAMES) command.option(`--${name}`, `Set up ${getAgent(name).displayName}`);

  command
    .option("--mode <mode>", "auto (plugin where supported, else MCP + skill), plugin, or mcp", "auto")
    .option("-p, --project", "Configure the current project instead of your user config")
    .option("-y, --yes", "Do not prompt; without agent flags, set up every detected agent")
    .option("--dry-run", "Show what would change without writing anything")
    .option("--json", "Print the result as JSON")
    .action(async (_flags: unknown, cmd: Command) => {
      await runSetup(cmd);
    });
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function detectAgents(scope: Scope): Promise<AgentName[]> {
  const found: AgentName[] = [];
  for (const name of AGENT_NAMES) {
    for (const p of getAgent(name).detect(scope)) {
      if (await pathExists(p)) {
        found.push(name);
        break;
      }
    }
  }
  return found;
}

/** Prompts only when a person is at the terminal and has not opted out with --yes or --json. */
function isInteractive(flags: SetupFlags): boolean {
  const tty = ui.promptIO().input !== undefined || Boolean(process.stdin.isTTY && process.stdout.isTTY);
  return tty && !flags.yes && !flags.json;
}

function noAgentsError(detail: string): Error {
  const list = AGENT_NAMES.map((n) => `--${n}`).join(" ");
  return plainError(`No agents ${detail}. Pass one or more of: ${list}`);
}

async function resolveAgents(flags: SetupFlags, scope: Scope): Promise<AgentName[]> {
  const explicit = AGENT_NAMES.filter((n) => flags[n]);
  if (explicit.length > 0) return explicit;
  const detected = await detectAgents(scope);
  if (detected.length === 0) throw noAgentsError("selected or detected");
  return detected;
}

async function isConnected(name: AgentName, scope: Scope): Promise<boolean> {
  const agent = getAgent(name);
  if (await hasMcpEntry(agent, scope)) return true;
  // Plugin installs are tracked per user, so they only say something about the global scope.
  return scope === "global" && agent.plugin ? isPluginInstalled(agent.plugin.kind) : false;
}

async function promptScope(cmd: Command): Promise<Scope> {
  if (cmd.getOptionValueSource("project") !== undefined) return cmd.opts().project ? "project" : "global";
  return ui.pickOne<Scope>(
    "Where should Upstash be set up?",
    [
      { value: "global", label: "All projects", hint: "your user config" },
      { value: "project", label: "This project only", hint: ui.tildify(process.cwd()) },
    ],
    "global",
  );
}

async function promptAgents(flags: SetupFlags, scope: Scope): Promise<AgentName[]> {
  const explicit = AGENT_NAMES.filter((n) => flags[n]);
  if (explicit.length > 0) return explicit;
  const detected = await detectAgents(scope);
  const options = await Promise.all(
    AGENT_NAMES.map(async (name) => {
      const hint = (await isConnected(name, scope)) ? "already connected" : detected.includes(name) ? "detected" : undefined;
      return { value: name, label: getAgent(name).displayName, hint };
    }),
  );
  return ui.pickMany(
    `Which agents should use Upstash? ${ui.dim("(space to toggle, enter to confirm)")}`,
    options,
    detected,
  );
}

/** Picks plugin vs MCP + skill for one agent, with the reason when the plugin is ruled out up front. */
function chooseMethod(
  name: AgentName,
  mode: Mode,
  scope: Scope,
): { method: Method; note?: string } {
  const plugin = getAgent(name).plugin;
  if (mode === "mcp") return { method: "mcp" };
  if (!plugin) {
    return mode === "plugin"
      ? { method: "mcp", note: `${getAgent(name).displayName} has no plugin support; installed MCP + skill instead.` }
      : { method: "mcp" };
  }
  if (!plugin.scopes.includes(scope)) {
    return { method: "mcp", note: "Plugins install per user, not per project; wrote project-level MCP + skill instead." };
  }
  return { method: "plugin" };
}

async function setupMcp(
  name: AgentName,
  scope: Scope,
  dryRun: boolean,
  repo: () => Promise<RepoFiles>,
): Promise<{ ok: boolean; steps: Step[] }> {
  const agent = getAgent(name);
  const steps: Step[] = [];
  const mcpLabel = "MCP server upstash";
  const skillPath = join(agent.skillDir(scope), SKILL_NAME);
  const skillLabel = `Skill ${SKILL_NAME}`;

  if (dryRun) {
    steps.push({ label: mcpLabel, status: "planned", path: await resolveMcpPath(agent, scope) });
    steps.push({ label: skillLabel, status: "planned", path: skillPath });
    return { ok: true, steps };
  }

  try {
    const { path, replaced } = await writeMcpEntry(agent, scope);
    steps.push({ label: `${mcpLabel}${replaced ? ", replaced existing entry" : ""}`, status: "done", path });
  } catch (err) {
    steps.push({ label: mcpLabel, status: "failed", detail: err instanceof Error ? err.message : String(err) });
  }

  try {
    const files = subtree(await repo(), `skills/${SKILL_NAME}`);
    await writeTree(files, skillPath);
    steps.push({ label: skillLabel, status: "done", path: skillPath });
  } catch (err) {
    steps.push({ label: skillLabel, status: "failed", path: skillPath, detail: err instanceof Error ? err.message : String(err) });
  }

  return { ok: steps.every((s) => s.status !== "failed"), steps };
}

interface AgentContext {
  mode: Mode;
  scope: Scope;
  dryRun: boolean;
  repo: () => Promise<RepoFiles>;
}

async function setupAgent(name: AgentName, ctx: AgentContext): Promise<AgentResult> {
  const { mode, scope, dryRun, repo } = ctx;
  const agent = getAgent(name);
  const choice = chooseMethod(name, mode, scope);
  const notes = choice.note ? [choice.note] : [];

  if (choice.method === "plugin" && agent.plugin) {
    const res = await installPlugin(agent.plugin.kind, { scope, dryRun, run: runner, repo });
    if (res.ok || res.installed || mode === "plugin") {
      if (res.missing) notes.push(`\`${res.missing}\` not found on PATH.`);
      const manual = res.ok ? await hasMcpEntry(agent, scope) : undefined;
      if (manual) {
        notes.push(`${manual} also declares an "upstash" MCP server; remove it so the agent does not load the server twice.`);
      }
      return { agent: name, name: agent.displayName, method: "plugin", ok: res.ok, steps: res.steps, notes: [...notes, ...res.notes] };
    }
    const why = res.missing
      ? `\`${res.missing}\` not found on PATH`
      : `plugin install failed (${res.steps.find((s) => s.status === "failed")?.detail ?? "unknown error"})`;
    notes.push(`${why}; installed MCP + skill instead.`);
  }

  if (agent.plugin && (await isPluginInstalled(agent.plugin.kind))) {
    notes.push("The Upstash plugin is also installed and brings its own MCP server; uninstall one of the two to avoid duplicate tools.");
  }
  const res = await setupMcp(name, scope, dryRun, repo);
  return { agent: name, name: agent.displayName, method: "mcp", ok: res.ok, steps: res.steps, notes };
}

/** One download serves every agent that needs files. */
function lazyRepo(): () => Promise<RepoFiles> {
  let repoPromise: Promise<RepoFiles> | undefined;
  return () => (repoPromise ??= fetchSkillsRepo());
}

export async function runSetup(cmd: Command): Promise<AgentResult[]> {
  const flags = cmd.optsWithGlobals() as SetupFlags;
  const mode = flags.mode as Mode;
  if (!["auto", "plugin", "mcp"].includes(mode)) throw plainError(`--mode must be auto, plugin, or mcp (got ${mode})`);

  if (!isInteractive(flags)) return runPlain(flags, mode);
  try {
    return await runInteractive(cmd, flags, mode);
  } catch (err) {
    if (!(err instanceof ui.SetupCancelled)) throw err;
    ui.cancelled(err.message);
    process.exitCode = 130;
    return [];
  }
}

async function runPlain(flags: SetupFlags, mode: Mode): Promise<AgentResult[]> {
  const scope: Scope = flags.project ? "project" : "global";
  const dryRun = Boolean(flags.dryRun);
  const agents = await resolveAgents(flags, scope);
  const ctx: AgentContext = { mode, scope, dryRun, repo: lazyRepo() };

  const results: AgentResult[] = [];
  for (const name of agents) results.push(await setupAgent(name, ctx));
  if (results.some((r) => !r.ok)) process.exitCode = 1;

  if (flags.json) {
    console.log(JSON.stringify({ scope, dry_run: dryRun, results }, null, 2));
  } else {
    printSummary(results, scope, dryRun);
  }
  return results;
}

async function runInteractive(cmd: Command, flags: SetupFlags, mode: Mode): Promise<AgentResult[]> {
  const dryRun = Boolean(flags.dryRun);
  ui.intro(dryRun ? "Upstash setup (dry run)" : "Upstash setup");

  const scope = await promptScope(cmd);
  const agents = await promptAgents(flags, scope);
  if (agents.length === 0) throw noAgentsError("selected");

  if (!dryRun) {
    const width = Math.max(...agents.map((n) => getAgent(n).displayName.length));
    const plan = agents.map((n) => {
      const { method } = chooseMethod(n, mode, scope);
      const what = method === "plugin" ? "Upstash plugin" : `MCP server + ${SKILL_NAME} skill`;
      return `${getAgent(n).displayName.padEnd(width)}  ${ui.dim(what)}`;
    });
    ui.note(plan.join("\n"), scope === "project" ? "Will set up in this project" : "Will set up for your user");
    if (!(await ui.confirm("Continue?"))) throw new ui.SetupCancelled();
  }

  const ctx: AgentContext = { mode, scope, dryRun, repo: lazyRepo() };
  const results: AgentResult[] = [];
  for (const name of agents) {
    const label = getAgent(name).displayName;
    const spin = ui.spinner();
    spin.start(`${dryRun ? "Planning" : "Setting up"} ${label}`);
    const res = await setupAgent(name, ctx);
    const title = `${label} ${ui.dim(`· ${METHOD_LABEL[res.method]}`)}`;
    if (res.ok) spin.stop(title);
    else spin.error(title);
    ui.printSteps(res.steps, res.notes);
    results.push(res);
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) process.exitCode = 1;

  if (dryRun) {
    ui.outro("Dry run: nothing was changed.");
  } else if (failed.length === results.length) {
    ui.outro("Setup failed. See the errors above.");
  } else {
    const next = [
      "Restart your agents to pick up the changes.",
      "On first use the Upstash MCP opens a browser consent page: pick the account,",
      "and turn read-only off if the agent should create or change resources.",
    ];
    ui.note(next.join("\n"), "Next steps");
    ui.outro(
      failed.length > 0
        ? `Connected ${results.length - failed.length} of ${results.length} agents to Upstash.`
        : `Connected ${results.length === 1 ? "1 agent" : `${results.length} agents`} to Upstash.`,
    );
  }
  return results;
}

const ICON: Record<Step["status"], string> = { done: "+", planned: "~", failed: "x" };

function printSummary(results: AgentResult[], scope: Scope, dryRun: boolean): void {
  const lines: string[] = [];
  const where = scope === "project" ? "this project" : "your user config";
  lines.push(`${dryRun ? "Dry run: " : ""}Upstash setup for ${where}`, "");
  for (const r of results) {
    lines.push(`${r.name} · ${METHOD_LABEL[r.method]}`);
    for (const s of r.steps) {
      lines.push(`  ${ICON[s.status]} ${s.label}${s.path ? ` → ${s.path}` : ""}`);
      if (s.detail) lines.push(`      ${s.detail}`);
    }
    for (const n of r.notes) lines.push(`  ! ${n}`);
    lines.push("");
  }
  if (!dryRun && results.some((r) => r.ok)) {
    lines.push(
      "Restart your agents to pick up the changes.",
      "On first use the Upstash MCP opens a browser consent page: pick the account, and turn read-only off if the agent should create or change resources.",
    );
  }
  console.log(lines.join("\n").trimEnd());
}
