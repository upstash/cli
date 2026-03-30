import { Command } from "commander";
import { resolveAuth } from "../../../auth.js";
import { request } from "../../../client.js";
import { printJSON, handleError } from "../../../output.js";

interface Flags {
  email?: string;
  apiKey?: string;
  json?: boolean;
  dryRun?: boolean;
}

export function registerBackupDelete(backup: Command): void {
  backup
    .command("delete <database-id> <backup-id>")
    .description("Delete a backup of a Redis database")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .option("--dry-run", "Preview the action without executing it")
    .action(async (databaseId: string, backupId: string, flags: Flags) => {
      if (flags.dryRun) {
        const preview = {
          action: "delete-backup",
          database_id: databaseId,
          backup_id: backupId,
          dry_run: true,
        };
        if (flags.json) {
          printJSON(preview);
          return;
        }
        console.log(`Dry run: would delete backup ${backupId} from database ${databaseId}`);
        return;
      }

      const auth = resolveAuth(flags);
      try {
        await request(
          auth,
          "DELETE",
          `/v2/redis/delete-backup/${databaseId}/${backupId}`,
        );
        if (flags.json) {
          printJSON({ deleted: true, backup_id: backupId });
          return;
        }
        console.log(`Backup ${backupId} deleted.`);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
