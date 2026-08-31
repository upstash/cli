import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import type { BlobBucket } from "../../types.js";

export function registerBlobGet(blob: Command): void {
  blob
    .command("get")
    .description("Get details of a Blob bucket")
    .requiredOption("--bucket-id <id>", "Blob bucket ID")
    .option("--hide-credentials", "Omit bucket tokens from output")
    .action(async (flags: { bucketId: string; hideCredentials?: boolean }, command: Command) => {
      const auth = resolveAuth(command);
      const bucket = await request<BlobBucket>(auth, "GET", `/v2/blob/bucket/${flags.bucketId}`);
      if (!flags.hideCredentials) {
        printJSON(bucket);
        return;
      }
      const { token: _token, token_next: _tokenNext, ...safeBucket } = bucket;
      printJSON(safeBucket);
    });
}
