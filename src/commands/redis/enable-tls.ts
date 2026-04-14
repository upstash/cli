import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";

export function registerEnableTls(redis: Command): void {
  redis
    .command("enable-tls")
    .description("Enable TLS for a Redis database")
    .requiredOption("--db-id <id>", "Database ID")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { dbId: string; email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      const result = await request(auth, "POST", `/v2/redis/enable-tls/${flags.dbId}`);
      printJSON(result);
    });
}
