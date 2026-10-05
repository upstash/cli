import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parse as parseToml } from "smol-toml";
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
 * For each line, whether it starts inside a multi-line string, so text there
 * that looks like `[table]` is never taken for a header.
 */
function linesInString(lines: string[]): boolean[] {
  let open: string | undefined;
  return lines.map((line) => {
    const inside = open !== undefined;
    for (const [delim] of line.matchAll(/"""|'''/g)) {
      if (open === undefined) open = delim;
      else if (open === delim) open = undefined;
    }
    return inside;
  });
}

/** Sets `value` at `path`, creating plain objects along the way. */
function setPath(target: Record<string, unknown>, path: string[], value: unknown): void {
  let node = target;
  for (const key of path.slice(0, -1)) {
    const next = node[key];
    node = (node[key] = next && typeof next === "object" && !Array.isArray(next) ? next : {}) as Record<string, unknown>;
  }
  node[path.at(-1)!] = value;
}

/** Structural equality for parsed TOML: ignores object prototypes, compares dates by their TOML text. */
function sameToml(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && String(a) === String(b);
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameToml(v, b[i]));
  }
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return (
    ka.length === kb.length &&
    ka.every((k) => Object.hasOwn(b, k) && sameToml((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  );
}

function getPath(target: unknown, path: string[]): unknown {
  let node = target;
  for (const key of path) {
    if (!node || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

function parseTomlOrThrow(text: string): Record<string, unknown> {
  try {
    return parseToml(text) as Record<string, unknown>;
  } catch (err) {
    const reason = err instanceof Error ? err.message.split("\n")[0] : String(err);
    throw new Error(`not valid TOML (${reason}); fix it and rerun`);
  }
}

/**
 * Sets `[table]` to `entry`: removes every `[table]` / `[table.*]` section
 * wherever it sits, writes the new block where the first one was (or at the
 * end), and leaves every other line, comments included, as it was.
 *
 * The edit is line-based to keep the file's formatting, so the result is
 * parsed and compared with the expected document before it is returned. A
 * layout this cannot rewrite safely (the table, or a parent table, defined
 * inline or with dotted keys) throws instead of producing a broken file.
 */
export function upsertTomlTable(
  existing: string,
  table: string,
  entry: Record<string, unknown>,
): { content: string; replaced: boolean } {
  const path = table.split(".");
  const before = parseTomlOrThrow(existing);
  const replaced = getPath(before, path) !== undefined;

  const lines = existing.split("\n");
  const inString = linesInString(lines);
  const headers = lines.flatMap((line, i) => (!inString[i] && /^\s*\[/.test(line) ? [i] : []));
  const block = buildTomlTable(table, entry).trimEnd().split("\n");

  const out: string[] = lines.slice(0, headers[0] ?? lines.length);
  let inserted = false;
  headers.forEach((start, n) => {
    const end = headers[n + 1] ?? lines.length;
    const keys = tableKeys(lines[start]!);
    if (keys && startsWith(keys, path)) {
      if (!inserted) out.push(...block, ...(end < lines.length ? [""] : []));
      inserted = true;
      return;
    }
    out.push(...lines.slice(start, end));
  });

  let content: string;
  if (inserted) {
    content = out.join("\n").trimEnd() + "\n";
  } else {
    const base = existing.trimEnd();
    content = (base ? `${base}\n\n` : "") + block.join("\n") + "\n";
  }

  // A fresh parse rather than a clone, so TOML dates keep their class.
  const expected = parseTomlOrThrow(existing);
  setPath(expected, path, entry);
  let after: unknown;
  try {
    after = parseToml(content);
  } catch {
    after = undefined;
  }
  if (!sameToml(after, expected)) {
    throw new Error(
      `can't add [${table}] safely: it, or a parent table, is defined inline or with dotted keys. Remove that definition or add the table by hand, then rerun`,
    );
  }
  return { content, replaced };
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
    try {
      ({ content, replaced } = upsertTomlTable(await readText(path), `${agent.mcp.configKey}.${SERVER_NAME}`, entry));
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
    try {
      const config = parseToml(await readText(path));
      return getPath(config, [agent.mcp.configKey, SERVER_NAME]) !== undefined ? path : undefined;
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
