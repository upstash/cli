import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";

export function registerEnableEviction(redis: Command): void {
  redis
    .command("enable-eviction")
    .description("Enable key eviction for a Redis database")
    .requiredOption("--db-id <id>", "Database ID")
    .action(async (flags: { dbId: string }, command: Command) => {
      const auth = resolveAuth(command);
      const result = await request(auth, "POST", `/v2/redis/enable-eviction/${flags.dbId}`);
      printJSON(result);
    });
}
