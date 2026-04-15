import { Command } from "commander";
import { resolveAuth } from "../../../auth.js";
import { request } from "../../../client.js";
import { printJSON } from "../../../output.js";
import type { Backup } from "../../../types.js";

export function registerBackupList(backup: Command): void {
  backup
    .command("list")
    .description("List all backups for a Redis database")
    .requiredOption("--db-id <id>", "Database ID")
    .action(async (flags: { dbId: string }, command: Command) => {
      const auth = resolveAuth(command);
      const backups = await request<Backup[]>(auth, "GET", `/v2/redis/list-backup/${flags.dbId}`);
      printJSON(backups);
    });
}
