import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";

export function registerUpdateBudget(redis: Command): void {
  redis
    .command("update-budget")
    .description("Update the monthly spend budget for a Redis database (in cents)")
    .requiredOption("--db-id <id>", "Database ID")
    .requiredOption("--budget <amount>", "Monthly budget in cents", parseInt)
    .action(async (flags: { dbId: string; budget: number }, command: Command) => {
      if (!Number.isFinite(flags.budget) || !Number.isInteger(flags.budget) || flags.budget < 0) {
        throw new Error(`Invalid --budget: "${flags.budget}". Must be a non-negative integer (cents).`);
      }
      const auth = resolveAuth(command);
      const result = await request(auth, "PATCH", `/v2/redis/update-budget/${flags.dbId}`, { budget: flags.budget });
      printJSON(result);
    });
}
