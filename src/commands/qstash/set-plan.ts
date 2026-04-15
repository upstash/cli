import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import { QSTASH_PLANS } from "../../types.js";

export function registerQStashSetPlan(qstash: Command): void {
  qstash
    .command("set-plan")
    .description(`Change the plan for a QStash instance. Plans: ${QSTASH_PLANS.join(", ")}`)
    .requiredOption("--qstash-id <id>", "QStash instance ID")
    .requiredOption("--plan <plan>", `Target plan (${QSTASH_PLANS.join(", ")})`)
    .action(async (flags: { qstashId: string; plan: string }, command: Command) => {
      const auth = resolveAuth(command);
      const result = await request(auth, "POST", `/v2/qstash/set-plan/${flags.qstashId}`, { plan_name: flags.plan });
      printJSON(result);
    });
}
