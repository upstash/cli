import { Command } from "commander";
import { resolve } from "node:path";
import { BucketResolver } from "./buckets.js";
import {
  addCommonOptions,
  addObjectOptions,
  claimLocal,
  destinationFor,
  executePlan,
  filtersOf,
  formatLocation,
  isIncluded,
  listDestination,
  listSource,
  localRel,
  parseLocation,
  transferAction,
} from "./transfer.js";
import type { Action, CommonOptions, Entry, Failure, ObjectOptions, Operation } from "./transfer.js";

interface SyncOptions extends CommonOptions, ObjectOptions {
  delete?: boolean;
  sizeOnly?: boolean;
  exactTimestamps?: boolean;
}

/**
 * aws s3 sync's rule: copy when sizes differ or the source is newer. Downloads are the exception,
 * skipping same-sized files unless the local copy is newer, or with --exact-timestamps unless the
 * times differ at all. Times compare at whole seconds, the precision LastModified has.
 */
export function needsSync(
  source: Entry,
  destination: Entry,
  action: Exclude<Action, "delete">,
  options: Pick<SyncOptions, "sizeOnly" | "exactTimestamps">,
): boolean {
  if (source.size !== destination.size) return true;
  if (options.sizeOnly) return false;
  const sourceTime = Math.floor(source.mtime / 1000);
  const destinationTime = Math.floor(destination.mtime / 1000);
  if (action === "download") {
    return options.exactTimestamps ? sourceTime !== destinationTime : destinationTime > sourceTime;
  }
  return sourceTime > destinationTime;
}

export function registerBlobSync(blob: Command): void {
  const command = blob
    .command("sync <source> <destination>")
    .description("Copy new and changed files between a directory and a blob:// prefix, or two prefixes, like aws s3 sync")
    .option("--delete", "Delete destination files that are not in the source (filters still apply)")
    .option("--size-only", "Compare sizes only, ignoring modification times")
    .option("--exact-timestamps", "When downloading, also copy same-sized files whose times differ");
  addObjectOptions(command);
  addCommonOptions(command);
  command
    .addHelpText("after", `
A file is copied when it is missing at the destination, its size differs, or the
source is newer. Downloads set local modification times to the object's upload
time, so a second sync copies nothing.

Examples:
  upstash blob sync ./site blob://my-bucket/site --delete
  upstash blob sync blob://my-bucket/backups ./backups --exclude "*" --include "*.gz"
`)
    .action(async (sourceArg: string, destinationArg: string, options: SyncOptions, cmd: Command) => {
      const source = parseLocation(sourceArg);
      const destination = parseLocation(destinationArg);
      if (source.type === "local" && destination.type === "local") {
        throw new Error("source or destination must be a blob://<bucket>/<prefix> URI");
      }
      const resolver = new BucketResolver(cmd, options.token);
      const filters = filtersOf(options);
      const action = transferAction(source, destination);
      const [sources, existing] = await Promise.all([
        listSource(source, true, resolver),
        listDestination(destination, resolver),
      ]);
      const included = (entry: Entry): boolean =>
        isIncluded(entry.rel, filters) && !(destination.type === "local" && entry.rel.endsWith("/"));
      const current = new Map(existing.filter(included).map((entry) => [entry.rel, entry]));

      const operations: Operation[] = [];
      const failures: Failure[] = [];
      let unchanged = 0;
      const wanted = new Set<string>();
      const claimed = new Set<string>();
      for (const entry of sources.filter(included)) {
        // Keys like "a//b" land on local "a/b", which is what the local listing reports.
        const rel = destination.type === "local" ? localRel(entry.rel) : entry.rel;
        wanted.add(rel);
        const target = current.get(rel);
        try {
          const to = target?.location ?? destinationFor(entry, destination, true);
          claimLocal(claimed, to);
          if (target && !needsSync(entry, target, action, options)) {
            unchanged++;
            continue;
          }
          operations.push({ action, source: entry.location, destination: to, size: entry.size });
        } catch (error) {
          failures.push({ source: formatLocation(entry.location), error: (error as Error).message });
        }
      }
      if (options.delete) {
        for (const [rel, entry] of current) {
          if (wanted.has(rel)) continue;
          // On a case-insensitive disk "a.txt" may be the file a source "A.txt" was just written to.
          if (entry.location.type === "local" && claimed.has(resolve(entry.location.path).toLowerCase())) continue;
          operations.push({ action: "delete", source: entry.location, size: 0 });
        }
      }
      await executePlan(operations, failures, options, resolver, { unchanged });
    });
}
