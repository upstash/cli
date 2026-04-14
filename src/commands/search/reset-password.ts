import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import type { SearchIndex } from "../../types.js";

export function registerSearchResetPassword(search: Command): void {
  search
    .command("reset-password")
    .description("Reset tokens for a search index")
    .requiredOption("--index-id <id>", "Search index ID")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { indexId: string; email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      const idx = await request<SearchIndex>(auth, "POST", `/v2/search/${flags.indexId}/reset-password`);
      printJSON(idx);
    });
}
