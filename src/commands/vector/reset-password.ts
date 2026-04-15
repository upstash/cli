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
    .action(async (flags: { indexId: string }, command: Command) => {
      const auth = resolveAuth(command);
      const idx = await request<VectorIndex>(auth, "POST", `/v2/vector/index/${flags.indexId}/reset-password`);
      printJSON(idx);
    });
}
