import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, printKeyValue, handleError } from "../../output.js";
import type { SearchIndex } from "../../types.js";

interface Flags { email?: string; apiKey?: string; json?: boolean }

export function registerSearchGet(search: Command): void {
  search
    .command("get <index-id>")
    .description("Get details of a search index")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (indexId: string, flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        const idx = await request<SearchIndex>(auth, "GET", `/v2/search/${indexId}`);
        if (flags.json) { printJSON(idx); return; }
        printKeyValue(idx as unknown as Record<string, unknown>);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
