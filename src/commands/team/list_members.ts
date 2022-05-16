import { cliffy } from "../../deps.ts";
import { Command } from "../../util/command.ts";
import { parseAuth } from "../../util/auth.ts";
import { http } from "../../util/http.ts";

export const listMembersCmd = new Command()
  .name("list-members")
  .description("List all members of a team")
  .option("--id <string>", "The team id")
  .example("List", "upstash team list-members")
  .action(async (options): Promise<void> => {
    const authorization = await parseAuth(options);

    if (!options.id) {
      if (options.ci) {
        throw new cliffy.ValidationError("teamID");
      }
      const teams = await http.request<
        { team_name: string; team_id: string }[]
      >({
        method: "GET",
        authorization,
        path: ["v2", "teams"],
      });
      options.id = await cliffy.Select.prompt({
        message: "Select a team to delete",
        options: teams.map(({ team_name, team_id }) => ({
          name: team_name,
          value: team_id,
        })),
      });
    }
    const members = await http.request<
      { database_name: string; database_id: string }[]
    >({
      method: "GET",
      authorization,
      path: ["v2", "teams", options.id!],
    });
    if (options.json) {
      console.log(JSON.stringify(members, null, 2));
      return;
    }

    members.forEach((member) => {
      console.log(
        cliffy.Table.from(
          Object.entries(member).map(([k, v]) => [k.toString(), v.toString()]),
        ).toString(),
      );
      console.log();
    });
    console.log();
    console.log();
  });
