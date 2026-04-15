import { Command, InvalidArgumentError } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";

function parseNonNegativeInt(name: string) {
  return (v: string): number => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) {
      throw new InvalidArgumentError(`--${name} must be a non-negative integer; got "${v}"`);
    }
    return n;
  };
}

export function registerUpdateBudget(redis: Command): void {
  redis
    .command("update-budget")
    .description("Update the monthly spend budget for a Redis database (in cents)")
    .requiredOption("--db-id <id>", "Database ID")
    .requiredOption("--budget <amount>", "Monthly budget in cents", parseNonNegativeInt("budget"))
    .action(async (flags: { dbId: string; budget: number }, command: Command) => {
      const auth = resolveAuth(command);
      const result = await request(auth, "PATCH", `/v2/redis/update-budget/${flags.dbId}`, { budget: flags.budget });
      printJSON(result);
    });
}
