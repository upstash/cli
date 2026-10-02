import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { SERVER_NAME, type AgentConfig, type Scope } from "./agents.js";

/** Reads a string literal starting at `i`; returns the index just past its closing quote. */
function skipString(text: string, i: number): number {
  i++;
  while (i < text.length && text[i] !== '"') {
    if (text[i] === "\\") i++;
    i++;
  }
  return i + 1;
}

/**
 * Turns JSONC (OpenCode, VS Code) into JSON: drops // and /* *\/ comments and
 * trailing commas outside strings.
 */
export function stripJsonc(text: string): string {
  return dropTrailingCommas(stripJsonComments(text));
}

function dropTrailingCommas(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      const end = skipString(text, i);
      out += text.slice(i, end);
      i = end;
    } else if (ch === ",") {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j]!)) j++;
      if (text[j] !== "}" && text[j] !== "]") out += ch;
      i++;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

function stripJsonComments(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      const end = skipString(text, i);
      out += text.slice(i, end);
      i = end;
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

/** A missing file reads as empty; any other read error is thrown so the file is never overwritten blind. */
async function readText(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw err;
  }
}

export async function readJsonConfig(path: string): Promise<Record<string, unknown>> {
  const raw = (await readText(path)).trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(stripJsonc(raw)) as unknown;
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

/** Serializes a flat entry as a TOML table. JSON string/array literals are valid TOML for the values we write. */
export function buildTomlTable(table: string, entry: Record<string, unknown>): string {
  const lines = [`[${table}]`];
  for (const [key, value] of Object.entries(entry)) lines.push(`${tomlKey(key)} = ${JSON.stringify(value)}`);
  return lines.join("\n") + "\n";
}

/** Splits a dotted TOML key (`mcp_servers."upstash"`) into its parts, or undefined if it is not one. */
function parseKeys(body: string): string[] | undefined {
  const keys: string[] = [];
  const re = /\s*("(?:[^"\\]|\\.)*"|'[^']*'|[A-Za-z0-9_-]+)\s*(\.|$)/y;
  let pos = 0;
  while (pos < body.length) {
    re.lastIndex = pos;
    const k = re.exec(body);
    if (!k) return undefined;
    const raw = k[1]!;
    keys.push(raw.startsWith('"') ? (JSON.parse(raw) as string) : raw.startsWith("'") ? raw.slice(1, -1) : raw);
    pos = re.lastIndex;
    if (!k[2]) break;
  }
  return pos >= body.length && keys.length > 0 ? keys : undefined;
}

/**
 * The dotted keys of a TOML table header, with quotes resolved, so
 * `[mcp_servers."upstash"]  # note` reads as ["mcp_servers", "upstash"].
 * Undefined for any line that is not a `[table]` header.
 */
function tableKeys(line: string): string[] | undefined {
  const m = /^\s*\[(?!\[)(.+)\]\s*(?:#.*)?$/.exec(line);
  return m ? parseKeys(m[1]!) : undefined;
}

const startsWith = (keys: string[], prefix: string[]): boolean =>
  keys.length >= prefix.length && prefix.every((k, i) => keys[i] === k);

/**
 * Whether `table` is defined anywhere other than its own `[table]` section:
 * as a dotted key (`mcp_servers.upstash.url = ...`) or an inline table
 * (`upstash = { ... }` under `[mcp_servers]`). Appending a `[table]` header
 * then would declare it twice and break the whole file.
 */
function definedOutsideTable(lines: string[], table: string): boolean {
  const want = table.split(".");
  let current: string[] = [];
  let inMultiline = false;
  for (const line of lines) {
    const quotes = (line.match(/"""|'''/g) ?? []).length;
    if (inMultiline) {
      if (quotes % 2 === 1) inMultiline = false;
      continue;
    }
    const array = /^\s*\[\[(.+)\]\]\s*(?:#.*)?$/.exec(line);
    const header = array ? parseKeys(array[1]!) : tableKeys(line);
    if (header) {
      current = header;
      continue;
    }
    const kv = /^\s*([^=#\s][^=]*?)\s*=/.exec(line);
    const keys = kv ? parseKeys(kv[1]!) : undefined;
    if (keys && !startsWith(current, want) && startsWith([...current, ...keys], want)) return true;
    if (quotes % 2 === 1) inMultiline = true;
  }
  return false;
}

const isTableHeader = (line: string): boolean => /^\s*\[/.test(line) && (tableKeys(line) !== undefined || /^\s*\[\[/.test(line));

function isHeader(line: string, table: string): boolean {
  const keys = tableKeys(line);
  const want = table.split(".");
  return keys !== undefined && keys.length === want.length && keys.every((k, i) => k === want[i]);
}

function isSubTable(line: string, table: string): boolean {
  const keys = tableKeys(line);
  const want = table.split(".");
  return keys !== undefined && keys.length > want.length && startsWith(keys, want);
}

/**
 * Replaces `[table]` and its `[table.*]` sub-tables, or appends the block.
 * Throws when the table is also defined inline or with dotted keys, which
 * this line-based merge cannot rewrite safely.
 */
export function upsertTomlTable(
  existing: string,
  table: string,
  block: string,
): { content: string; replaced: boolean } {
  const lines = existing.split("\n");
  if (definedOutsideTable(lines, table)) {
    throw new Error(`${table} is defined inline or with dotted keys; replace it with a [${table}] table or remove it, then rerun`);
  }
  const start = lines.findIndex((l) => isHeader(l, table));
  if (start === -1) {
    const base = existing.trimEnd();
    return { content: (base ? `${base}\n\n` : "") + block, replaced: false };
  }
  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end]!;
    if (isTableHeader(line) && !isSubTable(line, table)) break;
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
): Promise<{ path: string; replaced: boolean }> {
  const path = await resolveMcpPath(agent, scope);
  const entry = agent.mcp.entry;
  let content: string;
  let replaced: boolean;

  if (agent.mcp.format === "toml") {
    const block = buildTomlTable(`${agent.mcp.configKey}.${SERVER_NAME}`, entry);
    try {
      ({ content, replaced } = upsertTomlTable(await readText(path), `${agent.mcp.configKey}.${SERVER_NAME}`, block));
    } catch (err) {
      throw new Error(`${path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    const merged = mergeServerEntry(await readJsonConfig(path), agent.mcp.configKey, SERVER_NAME, entry);
    content = JSON.stringify(merged.config, null, 2) + "\n";
    replaced = merged.replaced;
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  return { path, replaced };
}

/** Whether the agent's MCP config already declares the `upstash` server. */
export async function hasMcpEntry(agent: AgentConfig, scope: Scope): Promise<string | undefined> {
  const path = await resolveMcpPath(agent, scope);
  if (agent.mcp.format === "toml") {
    const table = `${agent.mcp.configKey}.${SERVER_NAME}`;
    try {
      const lines = (await readText(path)).split("\n");
      return lines.some((l) => isHeader(l, table)) || definedOutsideTable(lines, table) ? path : undefined;
    } catch {
      return undefined;
    }
  }
  try {
    const section = (await readJsonConfig(path))[agent.mcp.configKey];
    return section && typeof section === "object" && SERVER_NAME in section ? path : undefined;
  } catch {
    return undefined;
  }
}
