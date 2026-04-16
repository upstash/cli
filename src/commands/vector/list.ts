import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import type { VectorIndex } from "../../types.js";

export function registerVectorList(vector: Command): void {
  vector
    .command("list")
    .description("List all vector indexes")
    .action(async (flags: Record<string, never>, command: Command) => {
      const auth = resolveAuth(command);
      const indexes = await request<VectorIndex[]>(auth, "GET", "/v2/vector/index");
      printJSON(indexes);
    });
}
