import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { HttpError, request } from "../../client.js";
import { printJSON } from "../../output.js";
import { sleep } from "./retry.js";
import type { Sleep } from "./retry.js";
import type { Auth } from "../../auth.js";

const SERVER_ERROR_RETRY_DELAY_MS = 3000;
const SERVER_ERROR_MAX_RETRIES = 5;

/**
 * Deleting a bucket moments after creating it can fail with a 5xx while the
 * backend is still provisioning it. Retry briefly; a 404 after an earlier
 * attempt means that attempt actually went through.
 */
export async function deleteBlobBucket(
  auth: Auth,
  bucketId: string,
  pause: Sleep = sleep,
): Promise<void> {
  let retries = 0;
  for (;;) {
    try {
      await request(auth, "DELETE", `/v2/blob/bucket/${bucketId}`);
      return;
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      if (error.status === 404 && retries > 0) return;
      if (error.status >= 500 && retries < SERVER_ERROR_MAX_RETRIES) {
        retries += 1;
        await pause(SERVER_ERROR_RETRY_DELAY_MS);
        continue;
      }
      throw error;
    }
  }
}

export function registerBlobDelete(blob: Command): void {
  blob
    .command("delete")
    .description("Delete a Blob bucket")
    .requiredOption("--bucket-id <id>", "Blob bucket ID")
    .option("--dry-run", "Preview the action without executing it")
    .action(async (flags: { bucketId: string; dryRun?: boolean }, command: Command) => {
      if (flags.dryRun) {
        printJSON({ action: "delete", bucket_id: flags.bucketId, dry_run: true });
        return;
      }
      const auth = resolveAuth(command);
      await deleteBlobBucket(auth, flags.bucketId);
      printJSON({ deleted: true, bucket_id: flags.bucketId });
    });
}
