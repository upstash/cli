import { Command } from "commander";
import { resolveAuth } from "../../../auth.js";
import { request } from "../../../client.js";
import { printJSON, handleError } from "../../../output.js";

export function registerBackupRestore(backup: Command): void {
  backup
    .command("restore")
    .description("Restore a Redis database from a backup")
    .requiredOption("--db-id <id>", "Database ID")
    .requiredOption("--backup-id <id>", "ID of the backup to restore from")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { dbId: string; backupId: string; email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      try {
        const result = await request(auth, "POST", `/v2/redis/restore-backup/${flags.dbId}`, { backup_id: flags.backupId });
        printJSON(result);
      } catch (err) {
        handleError(err);
      }
    });
}
