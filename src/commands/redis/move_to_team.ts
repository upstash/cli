import { cliffy } from "../../deps.ts";
import { Command } from "../../util/command.ts";
import { parseAuth } from "../../util/auth.ts";
import { http } from "../../util/http.ts";

export const moveToTeamCmd = new Command()
  .name("move-to-team")
  .description("Move a redis database to another team")
  .option("--id=<string>", "The id of your database")
  .option("--team-id=<string>", "The id of a team")
  .example("Move", `upstash redis move-to-team`)
  .action(async (options): Promise<void> => {
    const authorization = await parseAuth(options);

    if (!options.id) {
      if (options.ci) {
        throw new cliffy.ValidationError("id");
      }
      const dbs = await http.request<
        { database_name: string; database_id: string }[]
      >({
        method: "GET",
        authorization,
        path: ["v2", "redis", "databases"],
      });
      options.id = await cliffy.Select.prompt({
        message: "Select a database to move",
        options: dbs.map(({ database_name, database_id }) => ({
          name: database_name,
          value: database_id,
        })),
      });
    }
    if (!options.teamId) {
      const teams = await http.request<
        { team_name: string; team_id: string }[]
      >({
        method: "GET",
        authorization,
        path: ["v2", "teams"],
      });
      options.teamId = await cliffy.Select.prompt({
        message: "Select the new team",
        options: teams.map(({ team_name, team_id }) => ({
          name: team_name,
          value: team_id,
        })),
      });
    }

    const db = await http.request({
      method: "POST",
      authorization,
      path: ["v2", "redis", "move-to-team"],
      body: {
        database_id: options.id,
        team_id: options.teamId,
      },
    });
    if (options.json) {
      console.log(JSON.stringify(db, null, 2));
      return;
    }
    console.log(cliffy.colors.brightGreen("Database has been moved"));
  });
