import { Command, InvalidArgumentError } from "commander";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { printJSON } from "../../output.js";
import { BucketResolver } from "./buckets.js";
import {
  addCommonOptions,
  addObjectOptions,
  destinationFor,
  executePlan,
  filtersOf,
  formatLocation,
  isDryRun,
  isIncluded,
  isLocalDirectory,
  listSource,
  parseLocation,
  transferAction,
} from "./transfer.js";
import type { CommonOptions, Failure, Location, ObjectOptions, Operation } from "./transfer.js";

interface CopyOptions extends CommonOptions, ObjectOptions {
  recursive?: boolean;
  expectedSize?: number;
}

function byteCount(value: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new InvalidArgumentError("must be a whole number of bytes");
  return number;
}

/** `cp - blob://...` uploads stdin and `cp blob://... -` writes the object to stdout, as aws s3 cp does. */
async function copyStream(source: Location, destination: Location, options: CopyOptions, resolver: BucketResolver): Promise<void> {
  if (options.recursive) throw new Error("- cannot be combined with --recursive");
  if (source.type === "local" && destination.type === "blob") {
    if (!destination.key || destination.key.endsWith("/")) {
      throw new Error("uploading stdin needs a full blob://<bucket>/<key> destination");
    }
    if (isDryRun(options)) {
      printJSON({ dry_run: true, operations: [{ action: "upload", source: "-", destination: formatLocation(destination) }] });
      return;
    }
    const bucket = await resolver.open(destination.bucket);
    const body = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>;
    // Without a declared size the SDK has to buffer the stream to learn its length.
    const result = await bucket.put(destination.key, body, {
      contentType: options.contentType ?? "application/octet-stream",
      cache: options.cacheControl,
      metadata: options.metadata,
      ...(options.expectedSize === undefined ? { maxSize: "5gb" } : { size: options.expectedSize }),
    });
    if (!options.quiet) console.error(`upload: - to ${formatLocation(destination)}`);
    printJSON({ completed: 1, bytes: result.size, failed: [], remaining: 0 });
    return;
  }
  if (source.type === "blob" && destination.type === "local") {
    if (!source.key || source.key.endsWith("/")) throw new Error("writing to stdout needs a full blob://<bucket>/<key> source");
    if (isDryRun(options)) {
      printJSON({ dry_run: true, operations: [{ action: "download", source: formatLocation(source), destination: "-" }] });
      return;
    }
    const blob = await (await resolver.open(source.bucket)).get(source.key);
    await pipeline(Readable.fromWeb(blob.body as NodeReadableStream<Uint8Array>), process.stdout);
    return;
  }
  throw new Error("- streams between stdin or stdout and a blob:// object");
}

function registerTransfer(blob: Command, name: "cp" | "mv"): void {
  const command = blob
    .command(`${name} <source> <destination>`)
    .description(name === "cp"
      ? "Copy a file or object, or a directory or prefix with --recursive, like aws s3 cp"
      : "Move a file or object, or a directory or prefix with --recursive, like aws s3 mv")
    .option("--recursive", "Copy everything below a local directory or blob:// prefix");
  addObjectOptions(command);
  addCommonOptions(command);
  if (name === "cp") {
    command.option("--expected-size <bytes>", "Size of the stdin stream for `cp - blob://...`; without it stdin is buffered in memory", byteCount);
  }
  command
    .addHelpText("after", `
Locations are local paths or blob://<bucket>/<key>, where <bucket> is a bucket
name or id. At least one side must be blob://. A destination ending in "/" (or an
existing local directory) keeps the source's file name. ${name === "cp"
      ? `Use - as the source or
destination to stream stdin or stdout.`
      : "Sources, local files included,\nare deleted after each successful copy."}

Examples:
  upstash blob ${name} ./photo.png blob://my-bucket/images/
  upstash blob ${name} blob://my-bucket/images ./images --recursive --exclude "*.tmp"
  upstash blob ${name} blob://my-bucket/a.txt blob://other-bucket/b.txt
`)
    .action(async (sourceArg: string, destinationArg: string, options: CopyOptions, cmd: Command) => {
      const source = parseLocation(sourceArg);
      const destination = parseLocation(destinationArg);
      if (source.type === "local" && destination.type === "local") {
        throw new Error("source or destination must be a blob://<bucket>/<key> URI");
      }
      const resolver = new BucketResolver(cmd, options.token);
      if (sourceArg === "-" || destinationArg === "-") {
        if (name === "mv") throw new Error("mv cannot stream stdin or stdout; use cp");
        await copyStream(source, destination, options, resolver);
        return;
      }

      const recursive = Boolean(options.recursive);
      const filters = filtersOf(options);
      const entries = (await listSource(source, recursive, resolver)).filter((entry) => isIncluded(entry.rel, filters));
      const into = recursive || (destination.type === "blob"
        ? !destination.key || destination.key.endsWith("/")
        : await isLocalDirectory(destination.path));
      const operations: Operation[] = [];
      const failures: Failure[] = [];
      for (const entry of entries) {
        // Zero-byte "folder" markers have no local file to become.
        if (destination.type === "local" && entry.rel.endsWith("/")) continue;
        try {
          operations.push({
            action: transferAction(source, destination),
            source: entry.location,
            destination: destinationFor(entry, destination, into),
            size: entry.size,
            move: name === "mv",
          });
        } catch (error) {
          failures.push({ source: formatLocation(entry.location), error: (error as Error).message });
        }
      }
      await executePlan(operations, failures, options, resolver);
    });
}

export function registerBlobCp(blob: Command): void {
  registerTransfer(blob, "cp");
}

export function registerBlobMv(blob: Command): void {
  registerTransfer(blob, "mv");
}
