import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, printKeyValue, handleError } from "../../output.js";
import type { Database } from "../../types.js";

interface Flags {
  email?: string;
  apiKey?: string;
  json?: boolean;
}

export function registerResetPassword(redis: Command): void {
  redis
    .command("reset-password <database-id>")
    .description("Reset the password of a Redis database")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (databaseId: string, flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        const db = await request<Database>(
          auth,
          "POST",
          `/v2/redis/reset-password/${databaseId}`,
        );
        if (flags.json) {
          printJSON(db);
          return;
        }
        console.log("Password reset successfully.");
        console.log();
        printKeyValue(db as unknown as Record<string, unknown>);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
