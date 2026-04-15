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
    .action(async (flags: { indexId: string }, command: Command) => {
      const auth = resolveAuth(command);
      const idx = await request<SearchIndex>(auth, "POST", `/v2/search/${flags.indexId}/reset-password`);
      printJSON(idx);
    });
}
