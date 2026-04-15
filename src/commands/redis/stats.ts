import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";

export function registerStats(redis: Command): void {
  redis
    .command("stats")
    .description("Get usage statistics for a Redis database")
    .requiredOption("--db-id <id>", "Database ID")
    .action(async (flags: { dbId: string }, command: Command) => {
      const auth = resolveAuth(command);
      const stats = await request<Record<string, unknown>>(auth, "GET", `/v2/redis/stats/${flags.dbId}`);
      printJSON(stats);
    });
}
