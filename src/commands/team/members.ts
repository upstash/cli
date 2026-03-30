import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";
import type { TeamMember } from "../../types.js";

export function registerTeamMembers(team: Command): void {
  team
    .command("members")
    .description("List all members of a team")
    .requiredOption("--team-id <id>", "Team ID")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { teamId: string; email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      try {
        const members = await request<TeamMember[]>(auth, "GET", `/v2/teams/${flags.teamId}`);
        printJSON(members);
      } catch (err) {
        handleError(err);
      }
    });
}
