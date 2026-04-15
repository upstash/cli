import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import { STATS_PERIODS } from "../../types.js";

export function registerVectorStats(vector: Command): void {
  vector
    .command("stats")
    .description("Get statistics across all vector indexes")
    .action(async (flags: Record<string, never>, command: Command) => {
      const auth = resolveAuth(command);
      const stats = await request<Record<string, unknown>>(auth, "GET", "/v2/vector/index/stats");
      printJSON(stats);
    });

  vector
    .command("index-stats")
    .description("Get statistics for a specific vector index")
    .requiredOption("--index-id <id>", "Vector index ID")
    .option("--period <period>", `Time period. Available: ${STATS_PERIODS.join(", ")}`, "1h")
    .action(async (flags: { indexId: string; period?: string }, command: Command) => {
      const auth = resolveAuth(command);
      const qs = flags.period ? `?period=${encodeURIComponent(flags.period)}` : "";
      const stats = await request<Record<string, unknown>>(auth, "GET", `/v2/vector/index/${flags.indexId}/stats${qs}`);
      printJSON(stats);
    });
}
