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
    .command("rm <uri>")
    .description("Delete an object, or every object below a prefix with --recursive, like aws s3 rm")
    .option("--recursive", "Delete every object below the prefix; blob://<bucket> alone empties the bucket");
  addCommonOptions(command);
  command
    .addHelpText("after", `
Examples:
  upstash blob rm blob://my-bucket/old.txt
  upstash blob rm blob://my-bucket/tmp --recursive --dryrun
`)
    .action(async (uri: string, options: RemoveOptions, cmd: Command) => {
      const location = parseBlobLocation(uri);
      const resolver = new BucketResolver(cmd, options.token);
      let operations: Operation[];
      if (options.recursive) {
        const bucket = await resolver.open(location.bucket);
        const filters = filtersOf(options);
        const entries = await listBlobs(bucket, location, dirPrefix(location.key));
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
