import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import type { Team } from "../../types.js";

export function registerTeamList(team: Command): void {
  team
    .command("list")
    .description("List all teams")
    .action(async (flags: Record<string, never>, command: Command) => {
      const auth = resolveAuth(command);
      const teams = await request<Team[]>(auth, "GET", "/v2/teams");
      printJSON(teams);
    });
}
