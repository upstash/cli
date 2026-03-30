import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";
import type { Team } from "../../types.js";

export function registerTeamList(team: Command): void {
  team
    .command("list")
    .description("List all teams")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      try {
        const teams = await request<Team[]>(auth, "GET", "/v2/teams");
        printJSON(teams);
      } catch (err) {
        handleError(err);
      }
    });
}
