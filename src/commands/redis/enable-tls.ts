import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";

export function registerEnableTls(redis: Command): void {
  redis
    .command("enable-tls")
    .description("Enable TLS for a Redis database")
    .requiredOption("--db-id <id>", "Database ID")
    .action(async (flags: { dbId: string }, command: Command) => {
      const auth = resolveAuth(command);
      const result = await request(auth, "POST", `/v2/redis/enable-tls/${flags.dbId}`);
      printJSON(result);
    });
}
