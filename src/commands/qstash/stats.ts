import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import { STATS_PERIODS } from "../../types.js";

export function registerQStashStats(qstash: Command): void {
  qstash
    .command("stats")
    .description("Get usage statistics for a QStash instance")
    .requiredOption("--qstash-id <id>", "QStash instance ID")
    .option("--period <period>", `Time period. Available: ${STATS_PERIODS.join(", ")}`, "1h")
    .action(async (flags: { qstashId: string; period?: string }, command: Command) => {
      const auth = resolveAuth(command);
      const qs = flags.period ? `?period=${encodeURIComponent(flags.period)}` : "";
      const stats = await request<Record<string, unknown>>(auth, "GET", `/v2/qstash/stats/${flags.qstashId}${qs}`);
      printJSON(stats);
    });
}
