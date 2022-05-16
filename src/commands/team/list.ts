import { cliffy } from "../../deps.ts";
import { Command } from "../../util/command.ts";
import { parseAuth } from "../../util/auth.ts";
import { http } from "../../util/http.ts";

export const listCmd = new Command()
  .name("list")
  .description("list all your teams")
  .example("List", "upstash team list")
  .action(async (options): Promise<void> => {
    const authorization = await parseAuth(options);

    const teams = await http.request<{ team_name: string }[]>({
      method: "GET",
      authorization,
      path: ["v2", "teams"],
    });
    if (options.json) {
      console.log(JSON.stringify(teams, null, 2));
      return;
    }

    teams.forEach((team) => {
      console.log();
      console.log();
      console.log(
        cliffy.colors.underline(cliffy.colors.brightGreen(team.team_name)),
      );
      console.log();
      console.log(
        cliffy.Table.from(
          Object.entries(team).map(([k, v]) => [k.toString(), v.toString()]),
        ).toString(),
      );
    });
  });
