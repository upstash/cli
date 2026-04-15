import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";

export function registerSearchTransfer(search: Command): void {
  search
    .command("transfer")
    .description("Transfer a search index to another team")
    .requiredOption("--index-id <id>", "Search index ID")
    .requiredOption("--target-account <id>", "Target team ID")
    .action(async (flags: { indexId: string; targetAccount: string }, command: Command) => {
      const auth = resolveAuth(command);
      const result = await request(auth, "POST", `/v2/search/${flags.indexId}/transfer`, { target_account: flags.targetAccount });
      printJSON(result);
    });
}
