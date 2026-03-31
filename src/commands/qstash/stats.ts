import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";
import { STATS_PERIODS } from "../../types.js";

export function registerQStashStats(qstash: Command): void {
  qstash
    .command("stats")
    .description("Get usage statistics for a QStash instance")
    .requiredOption("--qstash-id <id>", "QStash instance ID")
    .option("--period <period>", `Time period. Available: ${STATS_PERIODS.join(", ")}`, "1h")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { qstashId: string; email?: string; apiKey?: string; period?: string }) => {
      const auth = resolveAuth(flags);
      const qs = flags.period ? `?period=${encodeURIComponent(flags.period)}` : "";
      try {
        const stats = await request<Record<string, unknown>>(auth, "GET", `/v2/qstash/stats/${flags.qstashId}${qs}`);
        printJSON(stats);
      } catch (err) {
        handleError(err);
      }
    });
}
