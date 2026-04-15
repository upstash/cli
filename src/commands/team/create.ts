import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import type { Team } from "../../types.js";

export function registerTeamCreate(team: Command): void {
  team
    .command("create")
    .description("Create a new team")
    .requiredOption("--name <name>", "Team name")
    .option("--copy-cc", "Copy existing credit card information to the team")
    .action(async (flags: { name: string; copyCc?: boolean }, command: Command) => {
      const auth = resolveAuth(command);
      const t = await request<Team>(auth, "POST", "/v2/team", { team_name: flags.name, copy_cc: flags.copyCc ?? false });
      printJSON(t);
    });
}
