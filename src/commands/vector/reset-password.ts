import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import type { VectorIndex } from "../../types.js";

export function registerVectorResetPassword(vector: Command): void {
  vector
    .command("reset-password")
    .description("Reset tokens for a vector index")
    .requiredOption("--index-id <id>", "Vector index ID")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { indexId: string; email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      const idx = await request<VectorIndex>(auth, "POST", `/v2/vector/index/${flags.indexId}/reset-password`);
      printJSON(idx);
    });
}
