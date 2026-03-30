import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";

export function registerTeamRemoveMember(team: Command): void {
  team
    .command("remove-member")
    .description("Remove a member from a team")
    .requiredOption("--team-id <id>", "Team ID")
    .requiredOption("--member-email <email>", "Email of the member to remove")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--dry-run", "Preview the action without executing it")
    .action(async (flags: { email?: string; apiKey?: string; dryRun?: boolean; teamId: string; memberEmail: string }) => {
      if (flags.dryRun) {
        printJSON({ action: "remove-member", team_id: flags.teamId, member_email: flags.memberEmail, dry_run: true });
        return;
      }
      const auth = resolveAuth(flags);
      try {
        await request(auth, "DELETE", "/v2/teams/member", { team_id: flags.teamId, member_email: flags.memberEmail });
        printJSON({ removed: true, team_id: flags.teamId, member_email: flags.memberEmail });
      } catch (err) {
        handleError(err);
      }
    });
}
