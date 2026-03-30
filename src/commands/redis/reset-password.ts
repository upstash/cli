import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";
import type { Database } from "../../types.js";

export function registerResetPassword(redis: Command): void {
  redis
    .command("reset-password")
    .description("Reset the password of a Redis database")
    .requiredOption("--db-id <id>", "Database ID")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { dbId: string; email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      try {
        const db = await request<Database>(auth, "POST", `/v2/redis/reset-password/${flags.dbId}`);
        printJSON(db);
      } catch (err) {
        handleError(err);
      }
    });
}
