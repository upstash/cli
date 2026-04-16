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

export function registerQStashUpdateBudget(qstash: Command): void {
  qstash
    .command("update-budget")
    .description("Update the monthly spend budget for a QStash instance (in dollars, 0 = no limit)")
    .requiredOption("--qstash-id <id>", "QStash instance ID")
    .requiredOption("--budget <amount>", "Monthly budget in dollars (0 = no limit)", parseNonNegativeInt("budget"))
    .action(async (flags: { qstashId: string; budget: number }, command: Command) => {
      const auth = resolveAuth(command);
      const result = await request(auth, "PATCH", `/v2/qstash/update-budget/${flags.qstashId}`, { budget: flags.budget });
      printJSON(result);
    });
}
