import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, printTable, handleError } from "../../output.js";
import type { TeamMember } from "../../types.js";

interface Flags {
  email?: string;
  apiKey?: string;
  json?: boolean;
}

export function registerTeamMembers(team: Command): void {
  team
    .command("members <team-id>")
    .description("List all members of a team")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (teamId: string, flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        const members = await request<TeamMember[]>(auth, "GET", `/v2/teams/${teamId}`);
        if (flags.json) {
          printJSON(members);
          return;
        }
        if (members.length === 0) {
          console.log("No members found.");
          return;
        }
        printTable(
          ["EMAIL", "ROLE"],
          members.map((m) => [m.member_email, m.member_role]),
        );
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
