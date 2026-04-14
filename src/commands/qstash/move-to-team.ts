import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";

export function registerQStashMoveToTeam(qstash: Command): void {
  qstash
    .command("move-to-team")
    .description("Move a QStash instance to a team")
    .requiredOption("--qstash-id <id>", "QStash instance ID")
    .requiredOption("--target-team-id <id>", "Target team ID")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { email?: string; apiKey?: string; qstashId: string; targetTeamId: string }) => {
      const auth = resolveAuth(flags);
      const result = await request(auth, "POST", "/v2/qstash/move-to-team", { qstash_id: flags.qstashId, target_team_id: flags.targetTeamId });
      printJSON(result);
    });
}
