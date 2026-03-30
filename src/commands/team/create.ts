import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";
import type { Team } from "../../types.js";

export function registerTeamCreate(team: Command): void {
  team
    .command("create")
    .description("Create a new team")
    .requiredOption("--name <name>", "Team name")
    .option("--copy-cc", "Copy existing credit card information to the team")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { email?: string; apiKey?: string; name: string; copyCc?: boolean }) => {
      const auth = resolveAuth(flags);
      try {
        const t = await request<Team>(auth, "POST", "/v2/team", { team_name: flags.name, copy_cc: flags.copyCc ?? false });
        printJSON(t);
      } catch (err) {
        handleError(err);
      }
    });
}
