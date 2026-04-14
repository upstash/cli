import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
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
      throw new Error(`Invalid role '${flags.role}'. Valid roles: ${TEAM_MEMBER_ROLES.join(", ")}`);
      }
      const auth = resolveAuth(flags);
      const member = await request<TeamMember>(auth, "POST", "/v2/teams/member", {
        team_id: flags.teamId,
        member_email: flags.memberEmail,
        member_role: flags.role,
      });
      printJSON(member);
    });
}
