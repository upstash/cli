import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";

export function registerVectorTransfer(vector: Command): void {
  vector
    .command("transfer")
    .description("Transfer a vector index to another team")
    .requiredOption("--index-id <id>", "Vector index ID")
    .requiredOption("--target-account <id>", "Target team ID")
    .action(async (flags: { indexId: string; targetAccount: string }, command: Command) => {
      const auth = resolveAuth(command);
      const result = await request(auth, "POST", `/v2/vector/index/${flags.indexId}/transfer`, { target_account: flags.targetAccount });
      printJSON(result);
    });
}
