import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";

interface Flags {
  email?: string;
  apiKey?: string;
  json?: boolean;
  dryRun?: boolean;
  teamId: string;
  memberEmail: string;
}

export function registerTeamRemoveMember(team: Command): void {
  team
    .command("remove-member")
    .description("Remove a member from a team")
    .requiredOption("--team-id <id>", "Team ID")
    .requiredOption("--member-email <email>", "Email of the member to remove")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .option("--dry-run", "Preview the action without executing it")
    .action(async (flags: Flags) => {
      if (flags.dryRun) {
        const preview = {
          action: "remove-member",
          team_id: flags.teamId,
          member_email: flags.memberEmail,
          dry_run: true,
        };
        if (flags.json) {
          printJSON(preview);
          return;
        }
        console.log(
          `Dry run: would remove ${flags.memberEmail} from team ${flags.teamId}`,
        );
        return;
      }

      const auth = resolveAuth(flags);
      try {
        await request(auth, "DELETE", "/v2/teams/member", {
          team_id: flags.teamId,
          member_email: flags.memberEmail,
        });
        if (flags.json) {
          printJSON({ removed: true, team_id: flags.teamId, member_email: flags.memberEmail });
          return;
        }
        console.log(`${flags.memberEmail} removed from team ${flags.teamId}.`);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
