import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";
import type { SearchIndex } from "../../types.js";

export function registerSearchRename(search: Command): void {
  search
    .command("rename")
    .description("Rename a search index")
    .requiredOption("--index-id <id>", "Search index ID")
    .requiredOption("--name <name>", "New index name")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { indexId: string; email?: string; apiKey?: string; name: string }) => {
      const auth = resolveAuth(flags);
      try {
        const idx = await request<SearchIndex>(auth, "POST", `/v2/search/${flags.indexId}/rename`, { name: flags.name });
        printJSON(idx);
      } catch (err) {
        handleError(err);
      }
    });
}
