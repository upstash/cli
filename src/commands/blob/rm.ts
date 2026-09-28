import { Command } from "commander";
import { BucketResolver } from "./buckets.js";
import {
  addCommonOptions,
  dirPrefix,
  executePlan,
  filtersOf,
  formatLocation,
  isIncluded,
  listBlobs,
  parseBlobLocation,
} from "./transfer.js";
import type { CommonOptions, Operation } from "./transfer.js";

interface RemoveOptions extends CommonOptions {
  recursive?: boolean;
}

export function registerBlobRm(blob: Command): void {
  const command = blob
    .command("rm <path>")
    .description("Delete an object, or every object below a prefix with --recursive, like aws s3 rm")
    .option("-r, --recursive", "Delete every object below the prefix; a bucket alone empties it");
  addCommonOptions(command);
  command
    .addHelpText("after", `
Examples:
  upstash blob rm my-bucket/old.txt
  upstash blob rm my-bucket/tmp -r -n
`)
    .action(async (uri: string, options: RemoveOptions, cmd: Command) => {
      const location = parseBlobLocation(uri);
      const resolver = new BucketResolver(cmd, options.token);
      let operations: Operation[];
      if (options.recursive) {
        // A bare `rm -r build` is too easily meant as a local folder to empty a whole bucket.
        if (!location.key && !uri.startsWith("blob://")) {
          throw new Error(`to delete every object in ${location.bucket}, write blob://${location.bucket}, or remove the bucket with rb -f`);
        }
        const bucket = await resolver.open(location.bucket);
        const filters = filtersOf(options);
        const entries = await listBlobs(bucket, location, dirPrefix(location.key), true);
        operations = entries
          .filter((entry) => isIncluded(entry.rel, filters))
          .map((entry) => ({ action: "delete", source: entry.location, size: 0 }));
      } else {
        if (!location.key) throw new Error(`${formatLocation(location)} names no object; add a key, or --recursive to delete everything`);
        operations = [{ action: "delete", source: location, size: 0 }];
      }
      await executePlan(operations, [], options, resolver);
    });
}
