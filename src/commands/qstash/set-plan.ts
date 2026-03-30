import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";
import { QSTASH_PLANS } from "../../types.js";

export function registerQStashSetPlan(qstash: Command): void {
  qstash
    .command("set-plan")
    .description(`Change the plan for a QStash instance. Plans: ${QSTASH_PLANS.join(", ")}`)
    .requiredOption("--qstash-id <id>", "QStash instance ID")
    .requiredOption("--plan <plan>", `Target plan (${QSTASH_PLANS.join(", ")})`)
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { qstashId: string; email?: string; apiKey?: string; plan: string }) => {
      const auth = resolveAuth(flags);
      try {
        const result = await request(auth, "POST", `/v2/qstash/set-plan/${flags.qstashId}`, { plan_name: flags.plan });
        printJSON(result);
      } catch (err) {
        handleError(err);
      }
    });
}
