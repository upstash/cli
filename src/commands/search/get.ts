import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import type { SearchIndex } from "../../types.js";

export function registerSearchGet(search: Command): void {
  search
    .command("get")
    .description("Get details of a search index")
    .requiredOption("--index-id <id>", "Search index ID")
    .action(async (flags: { indexId: string }, command: Command) => {
      const auth = resolveAuth(command);
      const idx = await request<SearchIndex>(auth, "GET", `/v2/search/${flags.indexId}`);
      printJSON(idx);
    });
}
