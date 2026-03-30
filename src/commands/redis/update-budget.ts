import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";

interface Flags {
  email?: string;
  apiKey?: string;
  json?: boolean;
  budget: number;
}

export function registerUpdateBudget(redis: Command): void {
  redis
    .command("update-budget <database-id>")
    .description("Update the monthly spend budget for a Redis database (in cents)")
    .requiredOption("--budget <amount>", "Monthly budget in cents", parseInt)
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (databaseId: string, flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        await request(auth, "PATCH", `/v2/redis/update-budget/${databaseId}`, {
          budget: flags.budget,
        });
        if (flags.json) {
          printJSON({ success: true, database_id: databaseId, budget: flags.budget });
          return;
        }
        console.log(`Budget updated to ${flags.budget} cents/month.`);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
