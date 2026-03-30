import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";

export function registerTeamDelete(team: Command): void {
  team
    .command("delete")
    .description("Delete a team")
    .requiredOption("--team-id <id>", "Team ID")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--dry-run", "Preview the action without executing it")
    .action(async (flags: { teamId: string; email?: string; apiKey?: string; dryRun?: boolean }) => {
      if (flags.dryRun) {
        printJSON({ action: "delete", team_id: flags.teamId, dry_run: true });
        return;
      }
      const auth = resolveAuth(flags);
      try {
        await request(auth, "DELETE", `/v2/team/${flags.teamId}`);
        printJSON({ deleted: true, team_id: flags.teamId });
      } catch (err) {
        handleError(err);
      }
    });
}
