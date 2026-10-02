import { Command, Option } from "commander";
import { resolveAuth } from "../../auth.js";
import { HttpError, request } from "../../client.js";
import { printJSON } from "../../output.js";
import { bucketIdArgument } from "./buckets.js";
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
    .command("delete [bucket]")
    .description("Delete an empty Blob bucket, by name or id")
    .addOption(new Option("--bucket-id <id>").hideHelp())
    .option("-n, --dry-run", "Preview the action without executing it")
    .action(async (name: string | undefined, flags: { bucketId?: string; dryRun?: boolean }, command: Command) => {
      const id = await bucketIdArgument(command, name, flags);
      if (flags.dryRun) {
        printJSON({ action: "delete", bucket_id: id, dry_run: true });
        return;
      }
      await deleteBlobBucket(resolveAuth(command), id);
      printJSON({ deleted: true, bucket_id: id });
    });
}
