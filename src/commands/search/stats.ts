import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";
import { STATS_PERIODS } from "../../types.js";

interface Flags { email?: string; apiKey?: string; json?: boolean; period?: string }

export function registerSearchStats(search: Command): void {
  search
    .command("stats")
    .description("Get statistics across all search indexes")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        const stats = await request<Record<string, unknown>>(auth, "GET", "/v2/search/stats");
        printJSON(stats);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });

  search
    .command("index-stats <index-id>")
    .description("Get statistics for a specific search index")
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
          `/v2/search/${indexId}/stats${qs}`,
        );
        printJSON(stats);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
