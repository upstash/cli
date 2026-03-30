import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";
import { QSTASH_PLANS } from "../../types.js";

interface Flags { email?: string; apiKey?: string; json?: boolean; plan: string }

export function registerQStashSetPlan(qstash: Command): void {
  qstash
    .command("set-plan <qstash-id>")
    .description(`Change the plan for a QStash instance. Plans: ${QSTASH_PLANS.join(", ")}`)
    .requiredOption("--plan <plan>", `Target plan (${QSTASH_PLANS.join(", ")})`)
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (qstashId: string, flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        await request(auth, "POST", `/v2/qstash/set-plan/${qstashId}`, {
          plan_name: flags.plan,
        });
        if (flags.json) { printJSON({ success: true, qstash_id: qstashId, plan: flags.plan }); return; }
        console.log(`Plan changed to '${flags.plan}'.`);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
