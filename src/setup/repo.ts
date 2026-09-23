import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, sep } from "node:path";
import { gunzipSync } from "node:zlib";
import { SKILLS_REPO } from "./agents.js";

/** Repo-relative path → file contents. */
export type RepoFiles = Map<string, Buffer>;

const REF_PATTERN = /^[A-Za-z0-9._\/-]+$/;

function cString(buf: Buffer, start: number, length: number): string {
  const slice = buf.subarray(start, start + length);
  const nul = slice.indexOf(0);
  return slice.subarray(0, nul === -1 ? slice.length : nul).toString("utf8");
}

function paxPath(body: Buffer): string | undefined {
  // Records are "<len> key=value\n", len counting the whole record.
  let offset = 0;
  while (offset < body.length) {
    const space = body.indexOf(0x20, offset);
    if (space === -1) break;
    const len = Number.parseInt(body.subarray(offset, space).toString("utf8"), 10);
    if (!Number.isFinite(len) || len <= 0) break;
    const record = body.subarray(space + 1, offset + len - 1).toString("utf8");
    const eq = record.indexOf("=");
    if (eq !== -1 && record.slice(0, eq) === "path") return record.slice(eq + 1);
    offset += len;
  }
  return undefined;
}

/** Minimal reader for the ustar/pax archives GitHub serves; regular files only. */
export function parseTar(tar: Buffer): RepoFiles {
  const files: RepoFiles = new Map();
  let offset = 0;
  let longName: string | undefined;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    const size = Number.parseInt(cString(header, 124, 12).trim() || "0", 8);
    const type = String.fromCharCode(header[156] ?? 0);
    const bodyStart = offset + 512;
    const body = tar.subarray(bodyStart, bodyStart + size);
    offset = bodyStart + Math.ceil(size / 512) * 512;

    if (type === "x") {
      longName = paxPath(body) ?? longName;
      continue;
    }
    if (type === "L") {
      longName = cString(body, 0, body.length);
      continue;
    }
    if (type === "g") continue;

    const name = cString(header, 0, 100);
    const prefix = cString(header, 345, 155);
    const path = longName ?? (prefix ? `${prefix}/${name}` : name);
    longName = undefined;
    if (type === "0" || type === "\0") files.set(path, Buffer.from(body));
  }
  return files;
}

/** GitHub tarballs nest everything under `<repo>-<ref>/`. */
export function stripTopDir(files: RepoFiles): RepoFiles {
  const out: RepoFiles = new Map();
  for (const [path, content] of files) {
    const slash = path.indexOf("/");
    if (slash !== -1 && slash < path.length - 1) out.set(path.slice(slash + 1), content);
  }
  return out;
}

export async function fetchSkillsRepo(ref: string): Promise<RepoFiles> {
  if (!REF_PATTERN.test(ref)) throw new Error(`Invalid git ref: ${ref}`);
  const url = `https://codeload.github.com/${SKILLS_REPO}/tar.gz/${ref}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": "upstash/cli" } });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not download ${SKILLS_REPO}@${ref}: ${reason}`);
  }
  if (!res.ok) throw new Error(`Could not download ${SKILLS_REPO}@${ref}: HTTP ${res.status}`);
  return stripTopDir(parseTar(gunzipSync(Buffer.from(await res.arrayBuffer()))));
}

/** Files under `prefix/`, keyed by their path relative to it. */
export function subtree(files: RepoFiles, prefix: string): RepoFiles {
  const base = prefix.endsWith("/") ? prefix : `${prefix}/`;
  const out: RepoFiles = new Map();
  for (const [path, content] of files) {
    if (path.startsWith(base)) out.set(path.slice(base.length), content);
  }
  return out;
}

/**
 * Replaces `dest` with exactly `files`, so files removed upstream do not linger.
 * `dest` is always a directory this CLI owns (named `upstash`).
 */
export async function writeTree(files: RepoFiles, dest: string): Promise<number> {
  if (files.size === 0) throw new Error(`Nothing to install into ${dest}`);
  await rm(dest, { recursive: true, force: true });
  for (const [rel, content] of files) {
    const clean = normalize(rel);
    if (isAbsolute(clean) || clean === ".." || clean.startsWith(`..${sep}`)) {
      throw new Error(`Refusing to write outside ${dest}: ${rel}`);
    }
    const target = join(dest, clean);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return files.size;
}
