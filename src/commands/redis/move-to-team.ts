import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";

export function registerMoveToTeam(redis: Command): void {
  redis
    .command("move-to-team")
    .description("Move a Redis database to a team account")
    .requiredOption("--db-id <id>", "Database ID")
    .requiredOption("--team-id <id>", "Target team ID")
    .action(async (flags: { dbId: string; teamId: string }, command: Command) => {
      const auth = resolveAuth(command);
      const result = await request(auth, "POST", `/v2/redis/move-to-team`, { database_id: flags.dbId, team_id: flags.teamId });
      printJSON(result);
    });
}
