import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";

interface Flags {
  email?: string;
  apiKey?: string;
  json?: boolean;
  dryRun?: boolean;
}

export function registerTeamDelete(team: Command): void {
  team
    .command("delete <team-id>")
    .description("Delete a team")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .option("--dry-run", "Preview the action without executing it")
    .action(async (teamId: string, flags: Flags) => {
      if (flags.dryRun) {
        const preview = { action: "delete", team_id: teamId, dry_run: true };
        if (flags.json) {
          printJSON(preview);
          return;
        }
        console.log(`Dry run: would delete team ${teamId}`);
        return;
      }

      const auth = resolveAuth(flags);
      try {
        await request(auth, "DELETE", `/v2/team/${teamId}`);
        if (flags.json) {
          printJSON({ deleted: true, team_id: teamId });
          return;
        }
        console.log(`Team ${teamId} deleted.`);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
