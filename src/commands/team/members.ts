import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import type { TeamMember } from "../../types.js";

export function registerTeamMembers(team: Command): void {
  team
    .command("members")
    .description("List all members of a team")
    .requiredOption("--team-id <id>", "Team ID")
    .action(async (flags: { teamId: string }, command: Command) => {
      const auth = resolveAuth(command);
      const members = await request<TeamMember[]>(auth, "GET", `/v2/teams/${flags.teamId}`);
      printJSON(members);
    });
}
