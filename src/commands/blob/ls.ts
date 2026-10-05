import { Command } from "commander";
import { printJSON } from "../../output.js";
import { BucketResolver, listDirectory } from "./buckets.js";
import type { ListedObject } from "./buckets.js";
import { parseBlobLocation } from "./transfer.js";

interface ListOptions {
  recursive?: boolean;
  summarize?: boolean;
  token?: string;
}

export function registerBlobLs(blob: Command): void {
  blob
    .command("ls [path]")
    .alias("list")
    .description("List buckets, or the objects and prefixes under <bucket>/<prefix>, like aws s3 ls")
    .option("-r, --recursive", "List every object under the prefix instead of one level")
    .option("--summarize", "Add total_objects and total_size")
    .option("--token <token>", "Blob bucket token, used for the bucket it was issued for (default: UPSTASH_BLOB_TOKEN)")
    .addHelpText("after", `
<path> is my-bucket/prefix or blob://my-bucket/prefix, by bucket name or id.
Without --recursive the prefix is matched as typed, so my-bucket/img lists "img/"
as a prefix; add the slash to list inside it.

Examples:
  upstash blob ls
  upstash blob ls my-bucket
  upstash blob ls my-bucket/images/ -r --summarize
`)
    .action(async (uri: string | undefined, options: ListOptions, cmd: Command) => {
      const resolver = new BucketResolver(cmd, options.token);
      if (uri === undefined) {
        printJSON(await resolver.listAccountBuckets());
        return;
      }

      const location = parseBlobLocation(uri);
      const bucket = await resolver.open(location.bucket);
      const prefixes: string[] = [];
      const objects: ListedObject[] = [];
      let cursor: string | undefined;
      do {
        if (options.recursive) {
          const page = await bucket.list({ prefix: location.key, limit: 1000, cursor });
          for (const object of page.blobs) {
            objects.push({ key: object.path, size: object.size, last_modified: object.uploadedAt.toISOString(), etag: object.etag });
          }
          cursor = page.cursor;
        } else {
          const page = await listDirectory(bucket, location.key, cursor);
          prefixes.push(...page.prefixes);
          objects.push(...page.objects);
          cursor = page.cursor;
        }
      } while (cursor);

      printJSON({
        ...(!options.recursive && { prefixes }),
        objects,
        ...(options.summarize && {
          total_objects: objects.length,
          total_size: objects.reduce((sum, object) => sum + object.size, 0),
        }),
      });
    });
}
