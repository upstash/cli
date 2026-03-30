import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";
import type { Database } from "../../types.js";

export function registerRename(redis: Command): void {
  redis
    .command("rename")
    .description("Rename a Redis database")
    .requiredOption("--db-id <id>", "Database ID")
    .requiredOption("--name <name>", "New database name")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { dbId: string; name: string; email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      try {
        const db = await request<Database>(auth, "POST", `/v2/redis/rename/${flags.dbId}`, { name: flags.name });
        printJSON(db);
      } catch (err) {
        handleError(err);
      }
    });
}
