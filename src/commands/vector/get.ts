import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";
import type { VectorIndex } from "../../types.js";

export function registerVectorGet(vector: Command): void {
  vector
    .command("get")
    .description("Get details of a vector index")
    .requiredOption("--index-id <id>", "Vector index ID")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { indexId: string; email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      try {
        const idx = await request<VectorIndex>(auth, "GET", `/v2/vector/index/${flags.indexId}`);
        printJSON(idx);
      } catch (err) {
        handleError(err);
      }
    });
}
