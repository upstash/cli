import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";
import { TEAM_MEMBER_ROLES } from "../../types.js";
import type { TeamMember } from "../../types.js";

export function registerTeamAddMember(team: Command): void {
  team
    .command("add-member")
    .description("Add a member to a team")
    .requiredOption("--team-id <id>", "Team ID")
    .requiredOption("--member-email <email>", "Email of the member to add")
    .requiredOption("--role <role>", `Member role (${TEAM_MEMBER_ROLES.join(", ")})`)
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { email?: string; apiKey?: string; teamId: string; memberEmail: string; role: string }) => {
      if (!(TEAM_MEMBER_ROLES as readonly string[]).includes(flags.role)) {
        console.error(JSON.stringify({ error: `Invalid role '${flags.role}'. Valid roles: ${TEAM_MEMBER_ROLES.join(", ")}` }));
        process.exit(1);
      }
      const auth = resolveAuth(flags);
      try {
        const member = await request<TeamMember>(auth, "POST", "/v2/teams/member", {
          team_id: flags.teamId,
          member_email: flags.memberEmail,
          member_role: flags.role,
        });
        printJSON(member);
      } catch (err) {
        handleError(err);
      }
    });
}
