import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, printKeyValue, handleError } from "../../output.js";
import type { SearchIndex } from "../../types.js";

interface Flags { email?: string; apiKey?: string; json?: boolean }

export function registerSearchResetPassword(search: Command): void {
  search
    .command("reset-password <index-id>")
    .description("Reset tokens for a search index")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (indexId: string, flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        const idx = await request<SearchIndex>(
          auth,
          "POST",
          `/v2/search/${indexId}/reset-password`,
        );
        if (flags.json) { printJSON(idx); return; }
        console.log("Tokens reset successfully.");
        console.log();
        printKeyValue(idx as unknown as Record<string, unknown>);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
