import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";

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
      await request(auth, "DELETE", `/v2/blob/bucket/${flags.bucketId}`);
      printJSON({ deleted: true, bucket_id: flags.bucketId });
    });
}
