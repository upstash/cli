import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";

interface Flags { email?: string; apiKey?: string; json?: boolean; dryRun?: boolean }

export function registerSearchDelete(search: Command): void {
  search
    .command("delete <index-id>")
    .description("Delete a search index")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .option("--dry-run", "Preview the action without executing it")
    .action(async (indexId: string, flags: Flags) => {
      if (flags.dryRun) {
        const preview = { action: "delete", index_id: indexId, dry_run: true };
        if (flags.json) { printJSON(preview); return; }
        console.log(`Dry run: would delete search index ${indexId}`);
        return;
      }
      const auth = resolveAuth(flags);
      try {
        await request(auth, "DELETE", `/v2/search/${indexId}`);
        if (flags.json) { printJSON({ deleted: true, index_id: indexId }); return; }
        console.log(`Search index ${indexId} deleted.`);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
