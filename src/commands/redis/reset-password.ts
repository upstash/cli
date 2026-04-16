import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import type { Database } from "../../types.js";

export function registerResetPassword(redis: Command): void {
  redis
    .command("reset-password")
    .description("Reset the password of a Redis database")
    .requiredOption("--db-id <id>", "Database ID")
    .action(async (flags: { dbId: string }, command: Command) => {
      const auth = resolveAuth(command);
      const db = await request<Database>(auth, "POST", `/v2/redis/reset-password/${flags.dbId}`);
      printJSON(db);
    });
}
