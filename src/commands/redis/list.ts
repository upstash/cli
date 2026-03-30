import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";
import type { Database } from "../../types.js";

export function registerList(redis: Command): void {
  redis
    .command("list")
    .description("List all Redis databases")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      try {
        const dbs = await request<Database[]>(auth, "GET", "/v2/redis/databases");
        printJSON(dbs);
      } catch (err) {
        handleError(err);
      }
    });
}
