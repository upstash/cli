import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";
import type { SearchIndex } from "../../types.js";

export function registerSearchList(search: Command): void {
  search
    .command("list")
    .description("List all search indexes")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      try {
        const indexes = await request<SearchIndex[]>(auth, "GET", "/v2/search");
        printJSON(indexes);
      } catch (err) {
        handleError(err);
      }
    });
}
