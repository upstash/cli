import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";
import { VECTOR_PLANS } from "../../types.js";

interface Flags { email?: string; apiKey?: string; json?: boolean; plan: string }

export function registerVectorSetPlan(vector: Command): void {
  vector
    .command("set-plan <index-id>")
    .description(`Change the plan of a vector index. Plans: ${VECTOR_PLANS.join(", ")}`)
    .requiredOption("--plan <plan>", `Target plan (${VECTOR_PLANS.join(", ")})`)
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (indexId: string, flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        await request(auth, "POST", `/v2/vector/index/${indexId}/setplan`, {
          target_plan: flags.plan,
        });
        if (flags.json) { printJSON({ success: true, index_id: indexId, plan: flags.plan }); return; }
        console.log(`Plan changed to '${flags.plan}'.`);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
