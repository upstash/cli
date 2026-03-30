import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";

interface Flags {
  email?: string;
  apiKey?: string;
  json?: boolean;
  teamId: string;
}

export function registerMoveToTeam(redis: Command): void {
  redis
    .command("move-to-team <database-id>")
    .description("Move a Redis database to a team account")
    .requiredOption("--team-id <id>", "Target team ID")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (databaseId: string, flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        await request(auth, "POST", `/v2/redis/move-to-team`, {
          database_id: databaseId,
          team_id: flags.teamId,
        });
        if (flags.json) {
          printJSON({ success: true, database_id: databaseId, team_id: flags.teamId });
          return;
        }
        console.log(`Database ${databaseId} moved to team ${flags.teamId}.`);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
