import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";

export function registerQStashUpdateBudget(qstash: Command): void {
  qstash
    .command("update-budget")
    .description("Update the monthly spend budget for a QStash instance (in dollars, 0 = no limit)")
    .requiredOption("--qstash-id <id>", "QStash instance ID")
    .requiredOption("--budget <amount>", "Monthly budget in dollars (0 = no limit)", parseInt)
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { qstashId: string; email?: string; apiKey?: string; budget: number }) => {
      if (!Number.isFinite(flags.budget) || !Number.isInteger(flags.budget) || flags.budget < 0) {
      throw new Error(`Invalid --budget: "${flags.budget}". Must be a non-negative integer (dollars).`);
      }
      const auth = resolveAuth(flags);
      const result = await request(auth, "PATCH", `/v2/qstash/update-budget/${flags.qstashId}`, { budget: flags.budget });
      printJSON(result);
    });
}
