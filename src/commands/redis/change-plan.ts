import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";

const PLANS = ["free", "payg", "pro", "paid"];

interface Flags {
  email?: string;
  apiKey?: string;
  json?: boolean;
  plan: string;
}

export function registerChangePlan(redis: Command): void {
  redis
    .command("change-plan <database-id>")
    .description(`Change the pricing plan of a Redis database. Plans: ${PLANS.join(", ")}`)
    .requiredOption("--plan <plan>", `Plan type (${PLANS.join(", ")})`)
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (databaseId: string, flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        await request(auth, "POST", `/v2/redis/change-plan/${databaseId}`, {
          plan: flags.plan,
        });
        if (flags.json) {
          printJSON({ success: true, database_id: databaseId, plan: flags.plan });
          return;
        }
        console.log(`Plan changed to '${flags.plan}'.`);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
