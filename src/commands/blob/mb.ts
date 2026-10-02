import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { HttpError, request } from "../../client.js";
import { printJSON } from "../../output.js";
import { BLOB_VISIBILITIES } from "../../types.js";
import type { BlobBucket, BlobVisibility } from "../../types.js";
import { BucketResolver, findAccountBucket } from "./buckets.js";
import { parseVisibility } from "./create.js";
import { deleteBlobBucket } from "./delete.js";
import { listBlobs, parseBucket, runOperations } from "./transfer.js";

export function registerBlobMb(blob: Command): void {
  blob
    .command("mb <bucket>")
    .description("Create a bucket, like aws s3 mb (same as blob create)")
    .option(
      "--visibility <visibility>",
      `Bucket visibility. Available: ${BLOB_VISIBILITIES.join(", ")}`,
      parseVisibility,
      "private",
    )
    .option("--cors <origins...>", "Allowed CORS origins (space-separated)")
    .action(async (uri: string, flags: { visibility: BlobVisibility; cors?: string[] }, cmd: Command) => {
      const name = parseBucket(uri);
      const bucket = await request<BlobBucket>(resolveAuth(cmd), "POST", "/v2/blob/bucket", {
        name,
        visibility: flags.visibility,
        cors: flags.cors,
      });
      printJSON(bucket);
    });
}

export function registerBlobRb(blob: Command): void {
  blob
    .command("rb <bucket>")
    .description("Delete an empty bucket, or any bucket with --force, like aws s3 rb")
    .option("-f, --force", "First delete every object and abort incomplete multipart uploads")
    .option("-q, --quiet", "Suppress progress on stderr")
    .action(async (uri: string, flags: { force?: boolean; quiet?: boolean }, cmd: Command) => {
      const name = parseBucket(uri);
      const resolver = new BucketResolver(cmd);
      const auth = resolver.auth();
      const match = findAccountBucket(await resolver.listAccountBuckets(), name);
      let deletedObjects = 0;
      let abortedUploads = 0;
      if (flags.force) {
        const bucket = await resolver.open(match.id);
        // Addressed by id, which the deletes below reuse from the resolver's cache.
        const location = { type: "blob" as const, bucket: match.id, key: "" };
        const entries = await listBlobs(bucket, location, "", true);
        const summary = await runOperations(
          entries.map((entry) => ({ action: "delete", source: entry.location, size: 0 })),
          {
            resolver,
            concurrency: 1,
            signal: new AbortController().signal,
            progress: (line) => {
              if (!flags.quiet) console.error(line);
            },
          },
        );
        if (summary.failed.length > 0) {
          throw new Error(`${summary.failed.length} objects could not be deleted, so the bucket was kept`);
        }
        deletedObjects = summary.completed;
        for (const upload of await bucket.listMultipartUploads()) {
          await bucket.abortMultipartUpload(upload);
          abortedUploads++;
        }
      }
      try {
        await deleteBlobBucket(auth, match.id);
      } catch (error) {
        if (error instanceof HttpError && error.status === 400 && /not empty/i.test(error.message) && !flags.force) {
          throw new Error("bucket is not empty; rerun with --force to delete its objects first");
        }
        throw error;
      }
      printJSON({
        deleted: true,
        bucket: match.name,
        bucket_id: match.id,
        ...(flags.force && { objects_deleted: deletedObjects, multipart_uploads_aborted: abortedUploads }),
      });
    });
}
