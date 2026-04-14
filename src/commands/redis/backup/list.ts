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
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { dbId: string; email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      const backups = await request<Backup[]>(auth, "GET", `/v2/redis/list-backup/${flags.dbId}`);
      printJSON(backups);
    });
}
