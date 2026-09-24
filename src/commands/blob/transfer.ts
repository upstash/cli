import { BlobError } from "@upstash/blob";
import type { Bucket } from "@upstash/blob";
import { InvalidArgumentError, Option } from "commander";
import type { Command } from "commander";
import { randomUUID } from "node:crypto";
import { setMaxListeners } from "node:events";
import { createWriteStream } from "node:fs";
import { lstat, mkdir, opendir, rename, rm, stat, unlink, utimes } from "node:fs/promises";
import { basename, dirname, join, posix, relative, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import mime from "mime";
import { printJSON } from "../../output.js";
import type { BucketResolver } from "./buckets.js";
import { sleep } from "./retry.js";
import { concurrency, putFile, retryable } from "./upload.js";

export type Location =
  | { type: "local"; path: string }
  | { type: "blob"; bucket: string; key: string };

export type BlobLocation = Extract<Location, { type: "blob" }>;

export function parseLocation(value: string): Location {
  if (value.startsWith("blob://")) {
    const rest = value.slice("blob://".length);
    const slash = rest.indexOf("/");
    const bucket = slash === -1 ? rest : rest.slice(0, slash);
    if (!bucket) throw new Error(`"${value}" has no bucket: use blob://<bucket>/<key>`);
    return { type: "blob", bucket, key: slash === -1 ? "" : rest.slice(slash + 1) };
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    throw new Error(`unsupported location "${value}": use blob://<bucket>/<key> or a local path`);
  }
  return { type: "local", path: value };
}

export function parseBlobLocation(value: string): BlobLocation {
  const location = parseLocation(value);
  if (location.type !== "blob") throw new Error(`"${value}" is not a blob://<bucket>/<key> URI`);
  return location;
}

export function formatLocation(location: Location): string {
  return location.type === "blob" ? `blob://${location.bucket}/${location.key}` : location.path;
}

/** How aws s3 treats the source of a recursive command: as a directory, whether or not it ends in a slash. */
export function dirPrefix(key: string): string {
  return key === "" || key.endsWith("/") ? key : `${key}/`;
}

// ── Filters ─────────────────────────────────────────────────────────────────

interface FilterFlag {
  exclude: boolean;
  pattern: string;
  order: number;
}

export interface Filter {
  exclude: boolean;
  match: RegExp;
}

let filterOrder = 0;

function collectFilter(exclude: boolean) {
  return (pattern: string, previous: FilterFlag[] = []): FilterFlag[] => [
    ...previous,
    { exclude, pattern, order: filterOrder++ },
  ];
}

/** fnmatch, as aws s3 uses it: `*` also crosses slashes. */
export function globToRegExp(glob: string): RegExp {
  let source = "";
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i] ?? "";
    if (char === "*") source += ".*";
    else if (char === "?") source += ".";
    else if (char === "[") {
      let end = i + 1;
      if (glob[end] === "!") end++;
      if (glob[end] === "]") end++;
      while (end < glob.length && glob[end] !== "]") end++;
      if (end >= glob.length) {
        source += "\\[";
        continue;
      }
      let body = glob.slice(i + 1, end).replace(/[\\\]]/g, "\\$&");
      if (body.startsWith("!")) body = `^${body.slice(1)}`;
      else if (body.startsWith("^")) body = `\\${body}`;
      source += `[${body}]`;
      i = end;
    } else source += char.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  }
  return new RegExp(`^${source}$`, "s");
}

export function filtersOf(options: { exclude?: FilterFlag[]; include?: FilterFlag[] }): Filter[] {
  return [...(options.exclude ?? []), ...(options.include ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((flag) => ({ exclude: flag.exclude, match: globToRegExp(flag.pattern) }));
}

/** Everything is included until a filter matches; the last matching filter decides. */
export function isIncluded(path: string, filters: Filter[]): boolean {
  let included = true;
  for (const filter of filters) if (filter.match.test(path)) included = !filter.exclude;
  return included;
}

// ── Options ─────────────────────────────────────────────────────────────────

function parseMetadata(value: string): Record<string, string> {
  const text = value.trim();
  if (text.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new InvalidArgumentError("--metadata JSON is invalid");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
      !Object.values(parsed).every((entry) => typeof entry === "string")) {
      throw new InvalidArgumentError("--metadata JSON must map keys to string values");
    }
    return parsed as Record<string, string>;
  }
  const metadata: Record<string, string> = {};
  for (const pair of text.split(",")) {
    const eq = pair.indexOf("=");
    if (eq <= 0) throw new InvalidArgumentError("--metadata must be key=value[,key=value] or a JSON object");
    metadata[pair.slice(0, eq).trim()] = pair.slice(eq + 1);
  }
  return metadata;
}

export interface CommonOptions {
  token?: string;
  dryrun?: boolean;
  dryRun?: boolean;
  quiet?: boolean;
  concurrency: number;
  exclude?: FilterFlag[];
  include?: FilterFlag[];
}

export interface ObjectOptions {
  contentType?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
}

export function addCommonOptions(command: Command): Command {
  return command
    .option("--exclude <pattern>", "Skip paths matching this pattern; repeatable, the last matching filter wins", collectFilter(true))
    .option("--include <pattern>", "Keep paths matching this pattern even if an earlier --exclude matched", collectFilter(false))
    .option("--dryrun", "Show what would happen without changing anything")
    .addOption(new Option("--dry-run").hideHelp())
    .option("--quiet", "Suppress progress on stderr; still print the JSON summary")
    .option("--concurrency <count>", "Number of concurrent transfers (1-16)", concurrency, 4)
    .option("--token <token>", "Blob bucket token, used for the bucket it was issued for (default: UPSTASH_BLOB_TOKEN)");
}

export function addObjectOptions(command: Command): Command {
  return command
    .option("--content-type <type>", "Content type for every written object (default: guessed from the file name, or kept on copies)")
    .option("--cache-control <value>", "Cache-Control for written objects: a header value, a duration like 1h, immutable, revalidate or no-store")
    .option("--metadata <pairs>", "Metadata for written objects, as key=value[,key=value] or a JSON object", parseMetadata);
}

export function isDryRun(options: { dryrun?: boolean; dryRun?: boolean }): boolean {
  return Boolean(options.dryrun || options.dryRun);
}

// ── Listing ─────────────────────────────────────────────────────────────────

export interface Entry {
  /** Path below the listed directory or prefix, with forward slashes. */
  rel: string;
  size: number;
  /** Local mtime or the object's LastModified, in milliseconds. */
  mtime: number;
  location: Location;
}

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | undefined)?.code;
}

async function walk(root: string): Promise<Entry[]> {
  const entries: Entry[] = [];
  const visit = async (directory: string): Promise<void> => {
    for await (const dirent of await opendir(directory)) {
      const path = join(directory, dirent.name);
      if (dirent.isDirectory()) await visit(path);
      else if (dirent.isFile()) {
        const info = await lstat(path);
        entries.push({
          rel: relative(root, path).split(sep).join("/"),
          size: info.size,
          mtime: info.mtimeMs,
          location: { type: "local", path },
        });
      }
    }
  };
  await visit(root);
  return entries;
}

/**
 * Every object below `prefix`. Zero-byte "folder" markers ending in "/" are skipped, as aws s3 skips
 * them everywhere except deletes; `forDelete` keeps them, the marker at the prefix itself included.
 */
export async function listBlobs(bucket: Bucket, location: BlobLocation, prefix: string, forDelete = false): Promise<Entry[]> {
  const entries: Entry[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, limit: 1000, cursor });
    for (const blob of page.blobs) {
      const rel = blob.path.slice(prefix.length);
      if (!forDelete && (!rel || (blob.size === 0 && rel.endsWith("/")))) continue;
      entries.push({
        rel,
        size: blob.size,
        mtime: blob.uploadedAt.getTime(),
        location: { type: "blob", bucket: location.bucket, key: blob.path },
      });
    }
    cursor = page.cursor;
  } while (cursor);
  return entries;
}

/** What a cp, mv or sync reads: one file or object, or everything below a directory or prefix. */
export async function listSource(location: Location, recursive: boolean, resolver: BucketResolver): Promise<Entry[]> {
  if (location.type === "local") {
    let info;
    try {
      info = await lstat(location.path);
    } catch (error) {
      if (errorCode(error) === "ENOENT") throw new Error(`${location.path} does not exist`);
      throw error;
    }
    if (info.isDirectory()) {
      if (!recursive) throw new Error(`${location.path} is a directory; use --recursive`);
      return walk(location.path);
    }
    if (!info.isFile()) throw new Error(`${location.path} is not a regular file; symbolic links are not followed`);
    if (recursive) throw new Error(`${location.path} is a file; --recursive needs a directory`);
    return [{ rel: basename(location.path), size: info.size, mtime: info.mtimeMs, location }];
  }

  const bucket = await resolver.open(location.bucket);
  if (recursive) return listBlobs(bucket, location, dirPrefix(location.key));
  if (!location.key || location.key.endsWith("/")) {
    throw new Error(`${formatLocation(location)} is a prefix; use --recursive`);
  }
  const info = await bucket.info(location.key);
  return [{
    rel: location.key.slice(location.key.lastIndexOf("/") + 1),
    size: info.size,
    mtime: info.uploadedAt.getTime(),
    location,
  }];
}

/** What a sync compares against; a missing local directory is simply empty. */
export async function listDestination(location: Location, resolver: BucketResolver): Promise<Entry[]> {
  if (location.type === "blob") {
    return listBlobs(await resolver.open(location.bucket), location, dirPrefix(location.key));
  }
  try {
    const info = await lstat(location.path);
    if (!info.isDirectory()) throw new Error(`${location.path} is not a directory`);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return [];
    throw error;
  }
  return walk(location.path);
}

export async function isLocalDirectory(path: string): Promise<boolean> {
  if (path.endsWith("/") || path.endsWith(sep)) return true;
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

// ── Planning ────────────────────────────────────────────────────────────────

export type Action = "upload" | "download" | "copy" | "delete";

export interface Operation {
  action: Action;
  source: Location;
  destination?: Location;
  size: number;
  /** Delete the source once the transfer succeeds. */
  move?: boolean;
}

export interface Failure {
  source: string;
  destination?: string;
  error: string;
}

export function transferAction(source: Location, destination: Location): Exclude<Action, "delete"> {
  if (source.type === "local") return "upload";
  return destination.type === "local" ? "download" : "copy";
}

/**
 * Where one entry lands. A blob key ending in "/" or empty, a local directory, and every recursive
 * command take the source's relative path; otherwise the destination names the object or file.
 */
export function destinationFor(entry: Entry, destination: Location, into: boolean): Location {
  if (destination.type === "blob") {
    const key = into ? dirPrefix(destination.key) + entry.rel : destination.key;
    return { type: "blob", bucket: destination.bucket, key };
  }
  if (!into) return destination;
  const root = resolve(destination.path);
  const target = resolve(root, ...entry.rel.split("/"));
  if (!target.startsWith(root + sep)) {
    throw new Error(`${JSON.stringify(entry.rel)} would be written outside ${destination.path}`);
  }
  return { type: "local", path: join(destination.path, relative(root, target)) };
}

/** Where `rel` lands below a local directory, as the directory walk would report it. */
export function localRel(rel: string): string {
  return posix.normalize(rel).replace(/^\/+/, "");
}

/**
 * Two keys can land on one local file: `a//b` and `a/b`, or `A.txt` and `a.txt` on a
 * case-insensitive disk. Only the first may write it, so an mv cannot delete the other's source.
 */
export function claimLocal(claimed: Set<string>, destination: Location): void {
  if (destination.type !== "local") return;
  const key = resolve(destination.path).toLowerCase();
  if (claimed.has(key)) throw new Error(`another object is also written to ${destination.path}`);
  claimed.add(key);
}

export function describe(operation: Operation): string {
  const verb = operation.move ? "move" : operation.action;
  const source = formatLocation(operation.source);
  return operation.destination ? `${verb}: ${source} to ${formatLocation(operation.destination)}` : `${verb}: ${source}`;
}

// ── Execution ───────────────────────────────────────────────────────────────

export interface TransferSettings extends ObjectOptions {
  resolver: BucketResolver;
  concurrency: number;
  signal: AbortSignal;
  progress: (line: string) => void;
}

export interface TransferSummary {
  completed: number;
  bytes: number;
  failed: Failure[];
  remaining: number;
}

/** R2 copies server-side only up to 5 GiB; anything larger is streamed through the CLI. */
const MAX_SERVER_COPY_BYTES = 5 * 1024 ** 3;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function checkKey(key: string): void {
  if (!key) throw new Error("destination key is empty");
  if (Buffer.byteLength(key) > 1024 || /[\x00-\x1f\x7f\\]/.test(key) ||
    key.split("/").some((part) => part === "." || part === "..")) {
    throw new Error(`unsupported object key: ${JSON.stringify(key)}`);
  }
}

class TruncatedDownload extends Error {}

async function withRetries<T>(signal: AbortSignal, run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= 2 || signal.aborted || !(retryable(error) || error instanceof TruncatedDownload)) throw error;
    }
    await sleep(500 * 2 ** attempt);
  }
}

/** Writes to a temporary file beside the target and renames it, so a failed download leaves nothing half-written. */
async function download(bucket: Bucket, key: string, target: string, signal: AbortSignal): Promise<void> {
  await mkdir(dirname(target), { recursive: true });
  await withRetries(signal, async () => {
    const temp = join(dirname(target), `.upstash-${randomUUID().slice(0, 8)}.tmp`);
    try {
      const blob = await bucket.get(key);
      await pipeline(
        Readable.fromWeb(blob.body as NodeReadableStream<Uint8Array>),
        createWriteStream(temp, { flags: "wx" }),
        { signal },
      );
      const written = (await stat(temp)).size;
      if (written !== blob.size) throw new TruncatedDownload(`download ended after ${written} of ${blob.size} bytes`);
      // aws s3 sync compares local mtimes with LastModified, so keep them equal after a download.
      await utimes(temp, blob.uploadedAt, blob.uploadedAt);
      await rename(temp, target);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
  });
}

async function copyObject(
  from: Bucket,
  fromKey: string,
  to: Bucket,
  toKey: string,
  size: number,
  settings: TransferSettings,
): Promise<void> {
  if (from.s3().bucket === to.s3().bucket && size <= MAX_SERVER_COPY_BYTES) {
    await from.copy(fromKey, toKey, {
      ...(settings.contentType !== undefined && { contentType: settings.contentType }),
      ...(settings.cacheControl !== undefined && { cache: settings.cacheControl }),
      ...(settings.metadata !== undefined && { metadata: settings.metadata }),
    });
    return;
  }
  await withRetries(settings.signal, async () => {
    const blob = await from.get(fromKey);
    try {
      await to.put(toKey, blob.body, {
        size: blob.size,
        contentType: settings.contentType ?? blob.contentType,
        metadata: settings.metadata ?? blob.metadata,
        cache: settings.cacheControl,
      });
    } catch (error) {
      await blob.body.cancel().catch(() => undefined);
      throw error;
    }
  });
}

async function perform(operation: Operation, settings: TransferSettings): Promise<void> {
  const { source, destination } = operation;
  if (operation.action === "upload" && source.type === "local" && destination?.type === "blob") {
    checkKey(destination.key);
    const bucket = await settings.resolver.open(destination.bucket);
    await putFile(bucket, {
      source: source.path,
      path: destination.key,
      size: operation.size,
      contentType: settings.contentType ?? mime.getType(source.path) ?? "application/octet-stream",
    }, settings.signal, { cache: settings.cacheControl, metadata: settings.metadata });
    if (operation.move) await unlink(source.path);
    return;
  }
  if (operation.action === "download" && source.type === "blob" && destination?.type === "local") {
    const bucket = await settings.resolver.open(source.bucket);
    await download(bucket, source.key, destination.path, settings.signal);
    if (operation.move) await bucket.del(source.key);
    return;
  }
  if (operation.action === "copy" && source.type === "blob" && destination?.type === "blob") {
    checkKey(destination.key);
    const from = await settings.resolver.open(source.bucket);
    const to = await settings.resolver.open(destination.bucket);
    if (from.s3().bucket === to.s3().bucket && source.key === destination.key) {
      throw new Error("source and destination are the same object");
    }
    await copyObject(from, source.key, to, destination.key, operation.size, settings);
    if (operation.move) await from.del(source.key);
    return;
  }
  throw new Error(`cannot ${operation.action} ${formatLocation(source)}`);
}

function deletable(key: string): boolean {
  return key.length > 0 && !key.split("/").some((part) => part === "." || part === "..");
}

async function deleteAll(operations: Operation[], settings: TransferSettings, summary: TransferSummary): Promise<void> {
  const fail = (location: Location, error: string): void => {
    summary.failed.push({ source: formatLocation(location), error });
    settings.progress(`delete failed: ${formatLocation(location)} ${error}`);
  };
  const byBucket = new Map<string, string[]>();
  for (const operation of operations) {
    if (settings.signal.aborted) return;
    const location = operation.source;
    if (location.type === "local") {
      try {
        await unlink(location.path);
        summary.completed++;
        settings.progress(describe(operation));
      } catch (error) {
        fail(location, message(error));
      }
      summary.remaining--;
    } else {
      byBucket.set(location.bucket, [...(byBucket.get(location.bucket) ?? []), location.key]);
    }
  }
  for (const [name, keys] of byBucket) {
    let bucket: Bucket | undefined;
    let openError: unknown;
    try {
      bucket = await settings.resolver.open(name);
    } catch (error) {
      openError = error;
    }
    for (let i = 0; i < keys.length; i += 1000) {
      if (settings.signal.aborted) return;
      const chunk = keys.slice(i, i + 1000);
      const valid = chunk.filter(deletable);
      let failed = new Map<string, string>();
      for (const key of chunk) if (!deletable(key)) failed.set(key, "unsupported object key");
      if (!bucket) {
        for (const key of valid) failed.set(key, message(openError));
      } else if (valid.length > 0) {
        try {
          await bucket.del(valid);
        } catch (error) {
          const survivors = BlobError.is(error) && error.code === "partial_delete" ? error.failed ?? valid : valid;
          failed = new Map([...failed, ...survivors.map((key): [string, string] => [key, message(error)])]);
        }
      }
      for (const key of chunk) {
        const location: Location = { type: "blob", bucket: name, key };
        const error = failed.get(key);
        if (error === undefined) {
          summary.completed++;
          settings.progress(describe({ action: "delete", source: location, size: 0 }));
        } else fail(location, error);
        summary.remaining--;
      }
    }
  }
}

/** Transfers run concurrently and keep going past failures, as aws s3 does; deletes run after, in batches. */
export async function runOperations(operations: Operation[], settings: TransferSettings): Promise<TransferSummary> {
  const summary: TransferSummary = { completed: 0, bytes: 0, failed: [], remaining: operations.length };
  const transfers = operations.filter((operation) => operation.action !== "delete");
  const deletes = operations.filter((operation) => operation.action === "delete");
  let next = 0;
  const worker = async (): Promise<void> => {
    while (!settings.signal.aborted) {
      const operation = transfers[next++];
      if (!operation) return;
      try {
        await perform(operation, settings);
        summary.completed++;
        summary.bytes += operation.size;
        settings.progress(describe(operation));
      } catch (error) {
        const failure: Failure = { source: formatLocation(operation.source), error: message(error) };
        if (operation.destination) failure.destination = formatLocation(operation.destination);
        summary.failed.push(failure);
        const verb = operation.move ? "move" : operation.action;
        settings.progress(`${verb} failed: ${describe(operation).slice(verb.length + 2)} ${failure.error}`);
      } finally {
        summary.remaining--;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(settings.concurrency, transfers.length) }, () => worker()));
  if (!settings.signal.aborted) await deleteAll(deletes, settings, summary);
  return summary;
}

/**
 * Shared tail of cp, mv, rm and sync: print the plan on --dryrun, otherwise run it with Ctrl+C
 * stopping new work, then print the JSON summary and fail if anything did.
 */
export async function executePlan(
  operations: Operation[],
  failures: Failure[],
  options: CommonOptions & ObjectOptions,
  resolver: BucketResolver,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const progress = (line: string): void => {
    if (!options.quiet) console.error(line);
  };
  for (const failure of failures) progress(`skipped: ${failure.source} ${failure.error}`);
  if (isDryRun(options)) {
    for (const operation of operations) progress(`(dryrun) ${describe(operation)}`);
    printJSON({
      dry_run: true,
      operations: operations.map((operation) => ({
        action: operation.move ? "move" : operation.action,
        source: formatLocation(operation.source),
        ...(operation.destination && { destination: formatLocation(operation.destination) }),
        size: operation.size,
      })),
      ...extra,
      ...(failures.length > 0 && { skipped: failures }),
    });
    return;
  }

  const controller = new AbortController();
  // Each read stream and download adds an abort listener, removed only once it closes.
  setMaxListeners(0, controller.signal);
  const interrupt = (): void => controller.abort();
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  try {
    const summary = await runOperations(operations, {
      resolver,
      concurrency: options.concurrency,
      signal: controller.signal,
      progress,
      contentType: options.contentType,
      cacheControl: options.cacheControl,
      metadata: options.metadata,
    });
    summary.failed.unshift(...failures);
    printJSON({ ...summary, ...extra });
    if (controller.signal.aborted) throw new Error("interrupted; completed transfers remain");
    if (summary.failed.length > 0) {
      throw new Error(`${summary.failed.length} of ${operations.length + failures.length} operations failed; see the JSON summary`);
    }
  } finally {
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
  }
}
