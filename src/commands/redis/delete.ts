import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";

export function registerDelete(redis: Command): void {
  redis
    .command("delete")
    .description("Delete a Redis database")
    .requiredOption("--db-id <id>", "Database ID")
    .option("--dry-run", "Preview the action without executing it")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { dbId: string; dryRun?: boolean; email?: string; apiKey?: string }) => {
      if (flags.dryRun) {
        printJSON({ action: "delete", database_id: flags.dbId, dry_run: true });
        return;
      }
      const auth = resolveAuth(flags);
      try {
        await request(auth, "DELETE", `/v2/redis/database/${flags.dbId}`);
        printJSON({ deleted: true, database_id: flags.dbId });
      } catch (err) {
        handleError(err);
      }
    });
}
