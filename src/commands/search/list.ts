import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import type { SearchIndex } from "../../types.js";

export function registerSearchList(search: Command): void {
  search
    .command("list")
    .description("List all search indexes")
    .action(async (flags: Record<string, never>, command: Command) => {
      const auth = resolveAuth(command);
      const indexes = await request<SearchIndex[]>(auth, "GET", "/v2/search");
      printJSON(indexes);
    });
}
