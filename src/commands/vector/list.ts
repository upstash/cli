import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import type { VectorIndex } from "../../types.js";

export function registerVectorList(vector: Command): void {
  vector
    .command("list")
    .description("List all vector indexes")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      const indexes = await request<VectorIndex[]>(auth, "GET", "/v2/vector/index");
      printJSON(indexes);
    });
}
