import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import { VECTOR_PLANS } from "../../types.js";

export function registerVectorSetPlan(vector: Command): void {
  vector
    .command("set-plan")
    .description(`Change the plan of a vector index. Plans: ${VECTOR_PLANS.join(", ")}`)
    .requiredOption("--index-id <id>", "Vector index ID")
    .requiredOption("--plan <plan>", `Target plan (${VECTOR_PLANS.join(", ")})`)
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { indexId: string; email?: string; apiKey?: string; plan: string }) => {
      const auth = resolveAuth(flags);
      const result = await request(auth, "POST", `/v2/vector/index/${flags.indexId}/setplan`, { target_plan: flags.plan });
      printJSON(result);
    });
}
