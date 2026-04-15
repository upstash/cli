import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import type { Database } from "../../types.js";

export function registerList(redis: Command): void {
  redis
    .command("list")
    .description("List all Redis databases")
    .action(async (flags: Record<string, never>, command: Command) => {
      const auth = resolveAuth(command);
      const dbs = await request<Database[]>(auth, "GET", "/v2/redis/databases");
      printJSON(dbs);
    });
}
