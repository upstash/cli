import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";
import type { VectorIndex } from "../../types.js";

export function registerVectorRename(vector: Command): void {
  vector
    .command("rename")
    .description("Rename a vector index")
    .requiredOption("--index-id <id>", "Vector index ID")
    .requiredOption("--name <name>", "New index name")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { indexId: string; email?: string; apiKey?: string; name: string }) => {
      const auth = resolveAuth(flags);
      try {
        const idx = await request<VectorIndex>(auth, "POST", `/v2/vector/index/${flags.indexId}/rename`, { name: flags.name });
        printJSON(idx);
      } catch (err) {
        handleError(err);
      }
    });
}
