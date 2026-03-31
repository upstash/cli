import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";

export function registerUpdateBudget(redis: Command): void {
  redis
    .command("update-budget")
    .description("Update the monthly spend budget for a Redis database (in cents)")
    .requiredOption("--db-id <id>", "Database ID")
    .requiredOption("--budget <amount>", "Monthly budget in cents", parseInt)
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { dbId: string; budget: number; email?: string; apiKey?: string }) => {
      if (!Number.isFinite(flags.budget) || !Number.isInteger(flags.budget) || flags.budget < 0) {
        handleError(new Error(`Invalid --budget: "${flags.budget}". Must be a non-negative integer (cents).`));
      }
      const auth = resolveAuth(flags);
      try {
        const result = await request(auth, "PATCH", `/v2/redis/update-budget/${flags.dbId}`, { budget: flags.budget });
        printJSON(result);
      } catch (err) {
        handleError(err);
      }
    });
}
