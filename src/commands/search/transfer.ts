import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";

interface Flags { email?: string; apiKey?: string; json?: boolean; targetAccount: string }

export function registerSearchTransfer(search: Command): void {
  search
    .command("transfer <index-id>")
    .description("Transfer a search index to another team")
    .requiredOption("--target-account <team-id>", "Target team ID")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (indexId: string, flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        await request(auth, "POST", `/v2/search/${indexId}/transfer`, {
          target_account: flags.targetAccount,
        });
        if (flags.json) {
          printJSON({ success: true, index_id: indexId, target_account: flags.targetAccount });
          return;
        }
        console.log(`Index ${indexId} transferred to team ${flags.targetAccount}.`);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
