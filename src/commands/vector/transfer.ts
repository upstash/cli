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
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { indexId: string; email?: string; apiKey?: string; targetAccount: string }) => {
      const auth = resolveAuth(flags);
      const result = await request(auth, "POST", `/v2/vector/index/${flags.indexId}/transfer`, { target_account: flags.targetAccount });
      printJSON(result);
    });
}
