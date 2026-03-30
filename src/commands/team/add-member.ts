import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, printKeyValue, handleError } from "../../output.js";
import { TEAM_MEMBER_ROLES } from "../../types.js";
import type { TeamMember } from "../../types.js";

interface Flags {
  email?: string;
  apiKey?: string;
  json?: boolean;
  teamId: string;
  memberEmail: string;
  role: string;
}

export function registerTeamAddMember(team: Command): void {
  team
    .command("add-member")
    .description("Add a member to a team")
    .requiredOption("--team-id <id>", "Team ID")
    .requiredOption("--member-email <email>", "Email of the member to add")
    .requiredOption(
      "--role <role>",
      `Member role (${TEAM_MEMBER_ROLES.join(", ")})`,
    )
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (flags: Flags) => {
      if (!(TEAM_MEMBER_ROLES as readonly string[]).includes(flags.role)) {
        console.error(
          `Error: Invalid role '${flags.role}'. Valid roles: ${TEAM_MEMBER_ROLES.join(", ")}`,
        );
        process.exit(1);
      }

      const auth = resolveAuth(flags);
      try {
        const member = await request<TeamMember>(auth, "POST", "/v2/teams/member", {
          team_id: flags.teamId,
          member_email: flags.memberEmail,
          member_role: flags.role,
        });
        if (flags.json) {
          printJSON(member);
          return;
        }
        console.log(`${flags.memberEmail} added to team as '${flags.role}'.`);
        console.log();
        printKeyValue(member as unknown as Record<string, unknown>);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
