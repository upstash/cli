import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import { STATS_PERIODS } from "../../types.js";

export function registerVectorStats(vector: Command): void {
  vector
    .command("stats")
    .description("Get statistics across all vector indexes")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      const stats = await request<Record<string, unknown>>(auth, "GET", "/v2/vector/index/stats");
      printJSON(stats);
    });

  vector
    .command("index-stats")
    .description("Get statistics for a specific vector index")
    .requiredOption("--index-id <id>", "Vector index ID")
    .option("--period <period>", `Time period. Available: ${STATS_PERIODS.join(", ")}`, "1h")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { indexId: string; email?: string; apiKey?: string; period?: string }) => {
      const auth = resolveAuth(flags);
      const qs = flags.period ? `?period=${encodeURIComponent(flags.period)}` : "";
      const stats = await request<Record<string, unknown>>(auth, "GET", `/v2/vector/index/${flags.indexId}/stats${qs}`);
      printJSON(stats);
    });
}
