import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";

export function registerDisableEviction(redis: Command): void {
  redis
    .command("disable-eviction")
    .description("Disable key eviction for a Redis database")
    .requiredOption("--db-id <id>", "Database ID")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { dbId: string; email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      try {
        const result = await request(auth, "POST", `/v2/redis/disable-eviction/${flags.dbId}`);
        printJSON(result);
      } catch (err) {
        handleError(err);
      }
    });
}
