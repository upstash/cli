import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";
import { STATS_PERIODS } from "../../types.js";

export function registerSearchStats(search: Command): void {
  search
    .command("stats")
    .description("Get statistics across all search indexes")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      try {
        const stats = await request<Record<string, unknown>>(auth, "GET", "/v2/search/stats");
        printJSON(stats);
      } catch (err) {
        handleError(err);
      }
    });

  search
    .command("index-stats")
    .description("Get statistics for a specific search index")
    .requiredOption("--index-id <id>", "Search index ID")
    .option("--period <period>", `Time period. Available: ${STATS_PERIODS.join(", ")}`, "1h")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { indexId: string; email?: string; apiKey?: string; period?: string }) => {
      const auth = resolveAuth(flags);
      const qs = flags.period ? `?period=${encodeURIComponent(flags.period)}` : "";
      try {
        const stats = await request<Record<string, unknown>>(auth, "GET", `/v2/search/${flags.indexId}/stats${qs}`);
        printJSON(stats);
      } catch (err) {
        handleError(err);
      }
    });
}
