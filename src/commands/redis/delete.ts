import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";

interface Flags {
  email?: string;
  apiKey?: string;
  json?: boolean;
  dryRun?: boolean;
}

export function registerDelete(redis: Command): void {
  redis
    .command("delete <database-id>")
    .description("Delete a Redis database")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .option("--dry-run", "Preview the action without executing it")
    .action(async (databaseId: string, flags: Flags) => {
      if (flags.dryRun) {
        const preview = { action: "delete", database_id: databaseId, dry_run: true };
        if (flags.json) {
          printJSON(preview);
          return;
        }
        console.log(`Dry run: would delete database ${databaseId}`);
        return;
      }

      const auth = resolveAuth(flags);
      try {
        await request(auth, "DELETE", `/v2/redis/database/${databaseId}`);
        if (flags.json) {
          printJSON({ deleted: true, database_id: databaseId });
          return;
        }
        console.log(`Database ${databaseId} deleted.`);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
