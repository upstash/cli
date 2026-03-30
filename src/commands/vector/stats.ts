import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";
import { STATS_PERIODS } from "../../types.js";

interface Flags { email?: string; apiKey?: string; json?: boolean; period?: string }

export function registerVectorStats(vector: Command): void {
  vector
    .command("stats")
    .description("Get statistics across all vector indexes")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        const stats = await request<Record<string, unknown>>(
          auth,
          "GET",
          "/v2/vector/index/stats",
        );
        printJSON(stats);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });

  vector
    .command("index-stats <index-id>")
    .description("Get statistics for a specific vector index")
    .option(
      "--period <period>",
      `Time period for aggregation. Available: ${STATS_PERIODS.join(", ")}`,
      "1h",
    )
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (indexId: string, flags: Flags) => {
      const auth = resolveAuth(flags);
      const qs = flags.period ? `?period=${flags.period}` : "";
      try {
        const stats = await request<Record<string, unknown>>(
          auth,
          "GET",
          `/v2/vector/index/${indexId}/stats${qs}`,
        );
        printJSON(stats);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
