import { Command } from "commander";
import { resolveAuth } from "../../../auth.js";
import { request } from "../../../client.js";
import { printJSON, handleError } from "../../../output.js";

interface Flags {
  email?: string;
  apiKey?: string;
  json?: boolean;
  backupId: string;
}

export function registerBackupRestore(backup: Command): void {
  backup
    .command("restore <database-id>")
    .description("Restore a Redis database from a backup")
    .requiredOption("--backup-id <id>", "ID of the backup to restore from")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (databaseId: string, flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        await request(auth, "POST", `/v2/redis/restore-backup/${databaseId}`, {
          backup_id: flags.backupId,
        });
        if (flags.json) {
          printJSON({
            success: true,
            database_id: databaseId,
            backup_id: flags.backupId,
          });
          return;
        }
        console.log(
          `Restore started for database ${databaseId} from backup ${flags.backupId}.`,
        );
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
