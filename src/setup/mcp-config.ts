import { access, chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { SERVER_NAME, type AgentConfig, type McpAuth, type Scope } from "./agents.js";

/** Drops // and /* *\/ comments outside strings, so JSONC configs (OpenCode, VS Code) parse. */
export function stripJsonComments(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      const start = i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === "\\") i++;
        i++;
      }
      out += text.slice(start, ++i);
    } else if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
    } else if (ch === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

async function readText(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

export async function readJsonConfig(path: string): Promise<Record<string, unknown>> {
  const raw = (await readText(path)).trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(stripJsonComments(raw)) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  // Refuse to overwrite a file we cannot read back faithfully.
  throw new Error(`${path} is not a JSON object; fix or remove it and rerun`);
}

export function mergeServerEntry(
  config: Record<string, unknown>,
  configKey: string,
  name: string,
  entry: Record<string, unknown>,
): { config: Record<string, unknown>; replaced: boolean } {
  const current = config[configKey];
  const section =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return {
    config: { ...config, [configKey]: { ...section, [name]: entry } },
    replaced: name in section,
  };
}

const tomlKey = (key: string): string => (/^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key));

/**
 * Serializes a flat entry as a TOML table; nested objects become sub-tables
 * (`[mcp_servers.upstash.http_headers]`). JSON string/array literals are valid
 * TOML for the values we write.
 */
export function buildTomlTable(table: string, entry: Record<string, unknown>): string {
  const lines = [`[${table}]`];
  const subTables: string[] = [];
  for (const [key, value] of Object.entries(entry)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      subTables.push("", `[${table}.${tomlKey(key)}]`);
      for (const [k, v] of Object.entries(value)) subTables.push(`${tomlKey(k)} = ${JSON.stringify(v)}`);
    } else {
      lines.push(`${tomlKey(key)} = ${JSON.stringify(value)}`);
    }
  }
  return [...lines, ...subTables].join("\n") + "\n";
}

function isHeader(line: string, table: string): boolean {
  const t = line.trim();
  return t === `[${table}]` || t.startsWith(`[${table}] `) || t.startsWith(`[${table}]#`);
}

/** Replaces `[table]` and its `[table.*]` sub-tables, or appends the block. */
export function upsertTomlTable(
  existing: string,
  table: string,
  block: string,
): { content: string; replaced: boolean } {
  const lines = existing.split("\n");
  const start = lines.findIndex((l) => isHeader(l, table));
  if (start === -1) {
    const base = existing.trimEnd();
    return { content: (base ? `${base}\n\n` : "") + block, replaced: false };
  }
  let end = start + 1;
  while (end < lines.length) {
    const t = lines[end]!.trim();
    if (t.startsWith("[") && !t.startsWith(`[${table}.`)) break;
    end++;
  }
  const before = lines.slice(0, start).join("\n").trimEnd();
  const after = lines.slice(end).join("\n").trim();
  const content = [before, block.trimEnd(), after].filter((s) => s.length > 0).join("\n\n");
  return { content: content + "\n", replaced: true };
}

async function firstExisting(candidates: string[]): Promise<string> {
  for (const c of candidates) {
    try {
      await access(c);
      return c;
    } catch {
      // try the next one
    }
  }
  return candidates[0]!;
}

export function resolveMcpPath(agent: AgentConfig, scope: Scope): Promise<string> {
  return firstExisting(agent.mcp.paths(scope));
}

/** Writes the `upstash` server into the agent's MCP config, keeping every other server. */
export async function writeMcpEntry(
  agent: AgentConfig,
  scope: Scope,
  auth: McpAuth,
): Promise<{ path: string; replaced: boolean }> {
  const path = await resolveMcpPath(agent, scope);
  const entry = agent.mcp.buildEntry(auth);
  let content: string;
  let replaced: boolean;

  if (agent.mcp.format === "toml") {
    const block = buildTomlTable(`${agent.mcp.configKey}.${SERVER_NAME}`, entry);
    ({ content, replaced } = upsertTomlTable(await readText(path), `${agent.mcp.configKey}.${SERVER_NAME}`, block));
  } else {
    const merged = mergeServerEntry(await readJsonConfig(path), agent.mcp.configKey, SERVER_NAME, entry);
    content = JSON.stringify(merged.config, null, 2) + "\n";
    replaced = merged.replaced;
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  // An API-key setup puts a credential in this file; `mode` on writeFile only
  // applies when the file is created, so tighten existing files explicitly.
  if (auth.mode === "api-key" && process.platform !== "win32") await chmod(path, 0o600);
  return { path, replaced };
}

/** Whether the agent's MCP config already declares the `upstash` server. */
export async function hasMcpEntry(agent: AgentConfig, scope: Scope): Promise<string | undefined> {
  const path = await resolveMcpPath(agent, scope);
  if (agent.mcp.format === "toml") {
    const table = `${agent.mcp.configKey}.${SERVER_NAME}`;
    return (await readText(path)).split("\n").some((l) => isHeader(l, table)) ? path : undefined;
  }
  try {
    const section = (await readJsonConfig(path))[agent.mcp.configKey];
    return section && typeof section === "object" && SERVER_NAME in section ? path : undefined;
  } catch {
    return undefined;
  }
}
