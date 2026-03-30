import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";

export function registerStats(redis: Command): void {
  redis
    .command("stats")
    .description("Get usage statistics for a Redis database")
    .requiredOption("--db-id <id>", "Database ID")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { dbId: string; email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      try {
        const stats = await request<Record<string, unknown>>(auth, "GET", `/v2/redis/stats/${flags.dbId}`);
        printJSON(stats);
      } catch (err) {
        handleError(err);
      }
    });
}
