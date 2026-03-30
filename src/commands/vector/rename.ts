import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, printKeyValue, handleError } from "../../output.js";
import type { VectorIndex } from "../../types.js";

interface Flags { email?: string; apiKey?: string; json?: boolean; name: string }

export function registerVectorRename(vector: Command): void {
  vector
    .command("rename <index-id>")
    .description("Rename a vector index")
    .requiredOption("--name <name>", "New index name")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (indexId: string, flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        const idx = await request<VectorIndex>(
          auth,
          "POST",
          `/v2/vector/index/${indexId}/rename`,
          { name: flags.name },
        );
        if (flags.json) { printJSON(idx); return; }
        console.log(`Index renamed to '${idx.name}'.`);
        console.log();
        printKeyValue(idx as unknown as Record<string, unknown>);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
