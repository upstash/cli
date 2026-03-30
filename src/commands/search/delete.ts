import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";

export function registerSearchDelete(search: Command): void {
  search
    .command("delete")
    .description("Delete a search index")
    .requiredOption("--index-id <id>", "Search index ID")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--dry-run", "Preview the action without executing it")
    .action(async (flags: { indexId: string; email?: string; apiKey?: string; dryRun?: boolean }) => {
      if (flags.dryRun) {
        printJSON({ action: "delete", index_id: flags.indexId, dry_run: true });
        return;
      }
      const auth = resolveAuth(flags);
      try {
        await request(auth, "DELETE", `/v2/search/${flags.indexId}`);
        printJSON({ deleted: true, index_id: flags.indexId });
      } catch (err) {
        handleError(err);
      }
    });
}
