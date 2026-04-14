import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import type { Database } from "../../types.js";

export function registerGet(redis: Command): void {
  redis
    .command("get")
    .description("Get details of a Redis database")
    .requiredOption("--db-id <id>", "Database ID")
    .option("--hide-credentials", "Omit password from output")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { dbId: string; hideCredentials?: boolean; email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      const qs = flags.hideCredentials ? "?credentials=hide" : "";
      const db = await request<Database>(auth, "GET", `/v2/redis/database/${flags.dbId}${qs}`);
      printJSON(db);
    });
}
