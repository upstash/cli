import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import type { Database } from "../../types.js";

export function registerCreateBranch(redis: Command): void {
  redis
    .command("create-branch")
    .description(
      "Create a branch: a point-in-time copy of a Redis database with its own endpoint and password, billed as pay-as-you-go. It starts in state creating; poll `redis get` until state is active.",
    )
    .requiredOption("--db-id <id>", "ID of the database or branch to copy")
    .requiredOption("--name <name>", "Branch name, unique among the branches of the database")
    .action(async (flags: { dbId: string; name: string }, command: Command) => {
      const auth = resolveAuth(command);
      const branch = await request<Database>(auth, "POST", `/v2/redis/database/${flags.dbId}/branch`, { name: flags.name });
      printJSON(branch);
    });
}
