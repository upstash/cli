import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, printTable, handleError } from "../../output.js";
import type { SearchIndex } from "../../types.js";

interface Flags { email?: string; apiKey?: string; json?: boolean }

export function registerSearchList(search: Command): void {
  search
    .command("list")
    .description("List all search indexes")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        const indexes = await request<SearchIndex[]>(auth, "GET", "/v2/search");
        if (flags.json) { printJSON(indexes); return; }
        if (indexes.length === 0) { console.log("No search indexes found."); return; }
        printTable(
          ["ID", "NAME", "REGION", "TYPE", "ENDPOINT"],
          indexes.map((i) => [i.id, i.name, i.region, i.type, i.endpoint]),
        );
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
