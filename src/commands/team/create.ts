import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, printKeyValue, handleError } from "../../output.js";
import type { Team } from "../../types.js";

interface Flags {
  email?: string;
  apiKey?: string;
  json?: boolean;
  name: string;
  copyCc?: boolean;
}

export function registerTeamCreate(team: Command): void {
  team
    .command("create")
    .description("Create a new team")
    .requiredOption("--name <name>", "Team name")
    .option("--copy-cc", "Copy existing credit card information to the team")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        const t = await request<Team>(auth, "POST", "/v2/team", {
          team_name: flags.name,
          copy_cc: flags.copyCc ?? false,
        });
        if (flags.json) {
          printJSON(t);
          return;
        }
        console.log(`Team '${t.team_name}' created.`);
        console.log();
        printKeyValue(t as unknown as Record<string, unknown>);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
