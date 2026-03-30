import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";

interface Flags {
  email?: string;
  apiKey?: string;
  json?: boolean;
}

export function registerDisableEviction(redis: Command): void {
  redis
    .command("disable-eviction <database-id>")
    .description("Disable key eviction for a Redis database")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (databaseId: string, flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        await request(auth, "POST", `/v2/redis/disable-eviction/${databaseId}`);
        if (flags.json) {
          printJSON({ success: true, database_id: databaseId });
          return;
        }
        console.log("Eviction disabled.");
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
