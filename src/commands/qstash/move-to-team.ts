import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";

interface Flags {
  email?: string;
  apiKey?: string;
  json?: boolean;
  qstashId: string;
  targetTeamId: string;
}

export function registerQStashMoveToTeam(qstash: Command): void {
  qstash
    .command("move-to-team")
    .description("Move a QStash instance to a team")
    .requiredOption("--qstash-id <id>", "QStash instance ID")
    .requiredOption("--target-team-id <id>", "Target team ID")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        await request(auth, "POST", "/v2/qstash/move-to-team", {
          qstash_id: flags.qstashId,
          target_team_id: flags.targetTeamId,
        });
        if (flags.json) {
          printJSON({ success: true, qstash_id: flags.qstashId, target_team_id: flags.targetTeamId });
          return;
        }
        console.log(`QStash ${flags.qstashId} moved to team ${flags.targetTeamId}.`);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
