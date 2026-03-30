import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";

interface Flags { email?: string; apiKey?: string; json?: boolean; budget: number }

export function registerQStashUpdateBudget(qstash: Command): void {
  qstash
    .command("update-budget <qstash-id>")
    .description("Update the monthly spend budget for a QStash instance (in dollars, 0 = no limit)")
    .requiredOption("--budget <amount>", "Monthly budget in dollars (0 = no limit)", parseInt)
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (qstashId: string, flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        await request(auth, "PATCH", `/v2/qstash/update-budget/${qstashId}`, {
          budget: flags.budget,
        });
        if (flags.json) {
          printJSON({ success: true, qstash_id: qstashId, budget: flags.budget });
          return;
        }
        const label = flags.budget === 0 ? "no limit" : `$${flags.budget}/month`;
        console.log(`Budget updated to ${label}.`);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
