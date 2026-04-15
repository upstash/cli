import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";

export function registerTeamDelete(team: Command): void {
  team
    .command("delete")
    .description("Delete a team")
    .requiredOption("--team-id <id>", "Team ID")
    .option("--dry-run", "Preview the action without executing it")
    .action(async (flags: { teamId: string; dryRun?: boolean }, command: Command) => {
      if (flags.dryRun) {
        printJSON({ action: "delete", team_id: flags.teamId, dry_run: true });
        return;
      }
      const auth = resolveAuth(command);
      await request(auth, "DELETE", `/v2/team/${flags.teamId}`);
      printJSON({ deleted: true, team_id: flags.teamId });
    });
}
