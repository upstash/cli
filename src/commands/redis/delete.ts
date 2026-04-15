import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";

export function registerDelete(redis: Command): void {
  redis
    .command("delete")
    .description("Delete a Redis database")
    .requiredOption("--db-id <id>", "Database ID")
    .option("--dry-run", "Preview the action without executing it")
    .action(async (flags: { dbId: string; dryRun?: boolean }, command: Command) => {
      if (flags.dryRun) {
        printJSON({ action: "delete", database_id: flags.dbId, dry_run: true });
        return;
      }
      const auth = resolveAuth(command);
      await request(auth, "DELETE", `/v2/redis/database/${flags.dbId}`);
      printJSON({ deleted: true, database_id: flags.dbId });
    });
}
