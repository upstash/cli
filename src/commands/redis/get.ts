import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, printKeyValue, handleError } from "../../output.js";
import type { Database } from "../../types.js";

interface Flags {
  email?: string;
  apiKey?: string;
  json?: boolean;
  hideCredentials?: boolean;
}

export function registerGet(redis: Command): void {
  redis
    .command("get <database-id>")
    .description("Get details of a Redis database")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .option("--hide-credentials", "Omit password from output")
    .action(async (databaseId: string, flags: Flags) => {
      const auth = resolveAuth(flags);
      const qs = flags.hideCredentials ? "?credentials=hide" : "";
      try {
        const db = await request<Database>(auth, "GET", `/v2/redis/database/${databaseId}${qs}`);
        if (flags.json) {
          printJSON(db);
          return;
        }
        printKeyValue(db as unknown as Record<string, unknown>);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
