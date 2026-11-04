import { Command } from "commander";
import { resolveAuthWithSource } from "../auth.js";
import { fetchTokenInfo } from "../client.js";
import { getAccessToken } from "../oauth/refresh.js";
import { printJSON } from "../output.js";

export function registerWhoami(program: Command): void {
  program
    .command("whoami")
    .description("Show which credentials the CLI is using, and for a browser login, the team and whether it is read-only")
    .action(async (_flags: unknown, command: Command) => {
      const { auth, source } = resolveAuthWithSource(command);
      if (auth.kind === "api-key") {
        printJSON({ auth: "api-key", source, email: auth.email });
        return;
      }
      const info = await fetchTokenInfo(await getAccessToken());
      printJSON({
        auth: "oauth",
        source,
        email: info.email,
        team_id: info.team_id ?? null,
        team_role: info.team_role ?? null,
        read_only: info.read_only === true,
      });
    });
}
