import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, printKeyValue, handleError } from "../../output.js";
import type { VectorIndex } from "../../types.js";

interface Flags { email?: string; apiKey?: string; json?: boolean }

export function registerVectorGet(vector: Command): void {
  vector
    .command("get <index-id>")
    .description("Get details of a vector index")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (indexId: string, flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        const idx = await request<VectorIndex>(auth, "GET", `/v2/vector/index/${indexId}`);
        if (flags.json) { printJSON(idx); return; }
        printKeyValue(idx as unknown as Record<string, unknown>);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
