import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import type { VectorIndex } from "../../types.js";

export function registerVectorRename(vector: Command): void {
  vector
    .command("rename")
    .description("Rename a vector index")
    .requiredOption("--index-id <id>", "Vector index ID")
    .requiredOption("--name <name>", "New index name")
    .action(async (flags: { indexId: string; name: string }, command: Command) => {
      const auth = resolveAuth(command);
      const idx = await request<VectorIndex>(auth, "POST", `/v2/vector/index/${flags.indexId}/rename`, { name: flags.name });
      printJSON(idx);
    });
}
