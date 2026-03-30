import { Command } from "commander";
import { resolveAuth } from "../../../auth.js";
import { request } from "../../../client.js";
import { printJSON, printTable, handleError } from "../../../output.js";
import type { Backup } from "../../../types.js";

interface Flags {
  email?: string;
  apiKey?: string;
  json?: boolean;
}

export function registerBackupList(backup: Command): void {
  backup
    .command("list <database-id>")
    .description("List all backups for a Redis database")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (databaseId: string, flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        const backups = await request<Backup[]>(
          auth,
          "GET",
          `/v2/redis/list-backup/${databaseId}`,
        );
        if (flags.json) {
          printJSON(backups);
          return;
        }
        if (backups.length === 0) {
          console.log("No backups found.");
          return;
        }
        printTable(
          ["BACKUP_ID", "NAME", "CREATED"],
          backups.map((b) => [
            b.backup_id,
            b.backup_name,
            new Date(b.creation_time * 1000).toISOString(),
          ]),
        );
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
