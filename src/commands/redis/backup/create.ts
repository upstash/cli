import { Command } from "commander";
import { resolveAuth } from "../../../auth.js";
import { request } from "../../../client.js";
import { printJSON, handleError } from "../../../output.js";

interface Flags {
  email?: string;
  apiKey?: string;
  json?: boolean;
  name: string;
}

export function registerBackupCreate(backup: Command): void {
  backup
    .command("create <database-id>")
    .description("Create a backup of a Redis database")
    .requiredOption("--name <name>", "Backup name")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (databaseId: string, flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        await request(auth, "POST", `/v2/redis/create-backup/${databaseId}`, {
          name: flags.name,
        });
        if (flags.json) {
          printJSON({ success: true, database_id: databaseId, name: flags.name });
          return;
        }
        console.log(`Backup '${flags.name}' created.`);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
