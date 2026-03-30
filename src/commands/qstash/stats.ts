import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";
import { STATS_PERIODS } from "../../types.js";

interface Flags { email?: string; apiKey?: string; json?: boolean; period?: string }

export function registerQStashStats(qstash: Command): void {
  qstash
    .command("stats <qstash-id>")
    .description("Get usage statistics for a QStash instance")
    .option(
      "--period <period>",
      `Time period for aggregation. Available: ${STATS_PERIODS.join(", ")}`,
      "1h",
    )
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (qstashId: string, flags: Flags) => {
      const auth = resolveAuth(flags);
      const qs = flags.period ? `?period=${flags.period}` : "";
      try {
        const stats = await request<Record<string, unknown>>(
          auth,
          "GET",
          `/v2/qstash/stats/${qstashId}${qs}`,
        );
        printJSON(stats);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
