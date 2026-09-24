import { BlobError, Bucket } from "@upstash/blob";
import type { PutOptions } from "@upstash/blob";
import { Command, InvalidArgumentError } from "commander";
import { setMaxListeners } from "node:events";
import { createReadStream } from "node:fs";
import { lstat, opendir } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import mime from "mime";
import { printJSON } from "../../output.js";
import { telemetryStatus } from "../../telemetry.js";
import { fetchBlobCredentials, resolveBucketToken } from "./credentials.js";
import { sleep } from "./retry.js";

export interface UploadFile {
  source: string;
  path: string;
  size: number;
  contentType: string;
}

export interface UploadSummary {
  uploaded: number;
  skipped: number;
  bytes: number;
  failed: { path: string; error: string }[];
  remaining: number;
}

interface UploadOptions {
  bucketId?: string;
  token?: string;
  prefix: string;
  concurrency: number;
  skipExisting?: boolean;
  dryRun?: boolean;
  quiet?: boolean;
}

export function concurrency(value: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 16) {
    throw new InvalidArgumentError("concurrency must be an integer from 1 to 16");
  }
  return number;
}

export async function planUpload(source: string, prefix: string): Promise<UploadFile[]> {
  const root = resolve(source);
  const base = prefix.replace(/^\/+|\/+$/g, "");
  if (base.split("/").some((part) => part === "." || part === "..") || /[\x00-\x1f\x7f\\]/.test(base)) {
    throw new Error("prefix must not contain dot segments, backslashes, or control characters");
  }
  const rootStat = await lstat(root);
  if (!rootStat.isFile() && !rootStat.isDirectory()) {
    throw new Error("source must be a regular file or directory; symbolic links are not followed");
  }
  const files: UploadFile[] = [];
  const addFile = (path: string, size: number): void => {
    const name = rootStat.isFile() ? basename(path) : relative(root, path).split(sep).join("/");
    const key = base ? `${base}/${name}` : name;
    if (Buffer.byteLength(key) > 1024 || /[\x00-\x1f\x7f\\]/.test(key)) {
      throw new Error(`unsupported object path: ${JSON.stringify(key)}`);
    }
    files.push({ source: path, path: key, size, contentType: mime.getType(path) ?? "application/octet-stream" });
  };
  const walk = async (directory: string): Promise<void> => {
    for await (const entry of await opendir(directory)) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) addFile(path, (await lstat(path)).size);
    }
  };
  if (rootStat.isFile()) addFile(root, rootStat.size);
  else await walk(root);
  return files;
}

export function retryable(error: unknown): boolean {
  return BlobError.is(error) && (
    error.code === "rate_limited" || error.code === "not_ready" ||
    (error.status !== undefined && error.status >= 500)
  ) || error instanceof TypeError && (error.message === "fetch failed" || error.message === "terminated") ||
    error instanceof Error && error.name === "TimeoutError";
}

/** Streams one local file to the bucket, retrying transient failures from the start of the file. */
export async function putFile(
  bucket: Pick<Bucket, "put">,
  file: UploadFile,
  signal?: AbortSignal,
  options: Pick<PutOptions, "cache" | "metadata"> = {},
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) throw new Error("upload interrupted");
    const current = await lstat(file.source);
    if (!current.isFile() || current.size !== file.size) {
      throw new Error("source changed since scanning; rerun the command");
    }
    const stream = createReadStream(file.source, { signal, highWaterMark: 64 * 1024 });
    try {
      const body = Readable.toWeb(stream, {
        strategy: { highWaterMark: 64 * 1024, size: (chunk: Buffer) => chunk.byteLength },
      }) as ReadableStream<Uint8Array>;
      await bucket.put(file.path, body, {
        ...options,
        size: file.size,
        contentType: file.contentType,
      });
      return;
    } catch (error) {
      if (attempt >= 2 || signal?.aborted || !retryable(error)) throw error;
    } finally {
      stream.destroy();
    }
    await sleep(500 * 2 ** attempt);
  }
}

export async function uploadFiles(
  bucket: Pick<Bucket, "put" | "exists">,
  files: UploadFile[],
  options: Pick<UploadOptions, "concurrency" | "skipExisting">,
  progress: (message: string) => void,
  signal?: AbortSignal,
): Promise<UploadSummary> {
  const summary: UploadSummary = { uploaded: 0, skipped: 0, bytes: 0, failed: [], remaining: files.length };
  let next = 0;
  const worker = async (): Promise<void> => {
    while (summary.failed.length === 0 && !signal?.aborted) {
      const file = files[next++];
      if (!file) return;
      try {
        if (options.skipExisting && await bucket.exists(file.path)) {
          summary.skipped++;
          progress(`Skipped ${JSON.stringify(file.path)}`);
        } else {
          progress(`Uploading ${JSON.stringify(file.path)} (${file.size} bytes)`);
          await putFile(bucket, file, signal);
          summary.uploaded++;
          summary.bytes += file.size;
          progress(`Uploaded ${JSON.stringify(file.path)}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "upload failed";
        summary.failed.push({ path: file.path, error: message });
        progress(`Failed ${JSON.stringify(file.path)}: ${message}`);
      } finally {
        summary.remaining--;
      }
    }
  };
  await Promise.all(Array.from({ length: options.concurrency }, () => worker()));
  return summary;
}

export function registerBlobUpload(blob: Command): void {
  blob.command("upload <source>")
    .description("Upload a file or directory with automatic credential refresh")
    .option("--bucket-id <id>", "Blob bucket ID (otherwise uses UPSTASH_BLOB_TOKEN)")
    .option("--token <token>", "Blob bucket token; no management API key needed (overrides UPSTASH_BLOB_TOKEN)")
    .option("--prefix <prefix>", "Destination prefix; directories upload their contents", "")
    .option("--concurrency <count>", "Number of files uploaded concurrently (1-16)", concurrency, 4)
    .option("--skip-existing", "Skip keys already present, without comparing contents")
    .option("--dry-run", "List local files and destination paths without contacting Upstash")
    .option("--quiet", "Suppress progress on stderr; still print the JSON summary")
    .addHelpText("after", `
Directories are recursive. Symlinks and empty directories are skipped.
Existing keys are overwritten unless --skip-existing is set. Nothing is deleted.
Large files use multipart uploads; credentials refresh during the transfer.
An interrupted file restarts on rerun. --skip-existing skips completed keys,
so use it only when existing objects are already the versions you want.
`)
    .action(async (source: string, options: UploadOptions, command: Command) => {
      const files = await planUpload(source, options.prefix);
      if (options.dryRun) {
        printJSON({ dry_run: true, files, bytes: files.reduce((sum, file) => sum + file.size, 0) });
        return;
      }
      if (files.length === 0) throw new Error("source contains no regular files to upload");
      const { token, unauthorizedRetries } = await resolveBucketToken(options, command);
      // A bucket created moments ago answers 401 until provisioning finishes.
      if (unauthorizedRetries > 0) await fetchBlobCredentials(token, sleep, { unauthorizedRetries });
      const bucket = new Bucket({ token, enableTelemetry: telemetryStatus().enabled });
      const controller = new AbortController();
      // Each read stream adds an abort listener, removed only once it closes.
      setMaxListeners(0, controller.signal);
      const interrupt = (): void => controller.abort();
      process.once("SIGINT", interrupt);
      process.once("SIGTERM", interrupt);
      try {
        const summary = await uploadFiles(bucket, files, options, (message) => {
          if (!options.quiet) console.error(message);
        }, controller.signal);
        printJSON(summary);
        if (controller.signal.aborted) throw new Error("upload interrupted; completed objects remain in the bucket");
        if (summary.failed.length > 0) throw new Error("upload incomplete; see failed paths in the JSON summary");
      } finally {
        process.removeListener("SIGINT", interrupt);
        process.removeListener("SIGTERM", interrupt);
      }
    });
}
