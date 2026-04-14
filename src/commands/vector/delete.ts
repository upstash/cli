import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";

export function registerVectorDelete(vector: Command): void {
  vector
    .command("delete")
    .description("Delete a vector index")
    .requiredOption("--index-id <id>", "Vector index ID")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--dry-run", "Preview the action without executing it")
    .action(async (flags: { indexId: string; email?: string; apiKey?: string; dryRun?: boolean }) => {
      if (flags.dryRun) {
        printJSON({ action: "delete", index_id: flags.indexId, dry_run: true });
        return;
      }
      const auth = resolveAuth(flags);
      await request(auth, "DELETE", `/v2/vector/index/${flags.indexId}`);
      printJSON({ deleted: true, index_id: flags.indexId });
    });
}
