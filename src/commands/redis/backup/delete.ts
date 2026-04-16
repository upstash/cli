import { Command } from "commander";
import { resolveAuth } from "../../../auth.js";
import { request } from "../../../client.js";
import { printJSON } from "../../../output.js";

export function registerBackupDelete(backup: Command): void {
  backup
    .command("delete")
    .description("Delete a backup of a Redis database")
    .requiredOption("--db-id <id>", "Database ID")
    .requiredOption("--backup-id <id>", "Backup ID")
    .option("--dry-run", "Preview the action without executing it")
    .action(async (flags: { dbId: string; backupId: string; dryRun?: boolean }, command: Command) => {
      if (flags.dryRun) {
        printJSON({ action: "delete-backup", database_id: flags.dbId, backup_id: flags.backupId, dry_run: true });
        return;
      }
      const auth = resolveAuth(command);
      await request(auth, "DELETE", `/v2/redis/delete-backup/${flags.dbId}/${flags.backupId}`);
      printJSON({ deleted: true, backup_id: flags.backupId });
    });
}
