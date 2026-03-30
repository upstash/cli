import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, printTable, handleError } from "../../output.js";
import type { VectorIndex } from "../../types.js";

interface Flags { email?: string; apiKey?: string; json?: boolean }

export function registerVectorList(vector: Command): void {
  vector
    .command("list")
    .description("List all vector indexes")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        const indexes = await request<VectorIndex[]>(auth, "GET", "/v2/vector/index");
        if (flags.json) { printJSON(indexes); return; }
        if (indexes.length === 0) { console.log("No vector indexes found."); return; }
        printTable(
          ["ID", "NAME", "REGION", "TYPE", "SIMILARITY", "DIMENSIONS"],
          indexes.map((i) => [
            i.id,
            i.name,
            i.region,
            i.type,
            i.similarity_function,
            String(i.dimension_count),
          ]),
        );
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
