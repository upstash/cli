import { Command } from "commander";
import { resolveAuth } from "../../../auth.js";
import { request } from "../../../client.js";
import { printJSON } from "../../../output.js";

export function registerBackupCreate(backup: Command): void {
  backup
    .command("create")
    .description("Create a backup of a Redis database")
    .requiredOption("--db-id <id>", "Database ID")
    .requiredOption("--name <name>", "Backup name")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { dbId: string; name: string; email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      const result = await request(auth, "POST", `/v2/redis/create-backup/${flags.dbId}`, { name: flags.name });
      printJSON(result);
    });
}
