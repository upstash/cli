import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";

export function registerChangePlan(redis: Command): void {
  redis
    .command("change-plan")
    .description("Change the pricing plan of a Redis database. Plans: free, payg, pro, paid")
    .requiredOption("--db-id <id>", "Database ID")
    .requiredOption("--plan <plan>", "Plan type (free, payg, pro, paid)")
    .action(async (flags: { dbId: string; plan: string }, command: Command) => {
      const auth = resolveAuth(command);
      const result = await request(auth, "POST", `/v2/redis/change-plan/${flags.dbId}`, { plan: flags.plan });
      printJSON(result);
    });
}
