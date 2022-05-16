import { cliffy } from "../../deps.ts";
import { Command } from "../../util/command.ts";
import { parseAuth } from "../../util/auth.ts";
import { http } from "../../util/http.ts";

export const moveToTeamCmd = new Command()
  .name("move-to-team")
  .description("Move a redis database to another team")
  .arguments("[id] [teamID]")
  .example(
    "Move",
    `upstash redis move-to-team ${crypto.randomUUID()} ${crypto.randomUUID()}`,
  )
  .action(async (options, id, teamID): Promise<void> => {
    const authorization = await parseAuth(options);

    if (!id) {
      const dbs = await http.request<
        { database_name: string; database_id: string }[]
      >({
        method: "GET",
        authorization,
        path: ["v2", "redis", "databases"],
      });
      id = await cliffy.Select.prompt({
        message: "Select a database to rename",
        options: dbs.map(({ database_name, database_id }) => ({
          name: database_name,
          value: database_id,
        })),
      });
    }

    // if (!id) {
    //   id = await cliffy.Input.prompt({
    //     message: "Choose a new name",
    //   });
    // }
    const db = await http.request<Response>({
      method: "POST",
      authorization,
      path: ["v2", "redis", "rename", id!],
      body: {
        database_id: id,
        team_id: teamID,
      },
    });
    if (options.json) {
      console.log(JSON.stringify(db, null, 2));
      return;
    }
    console.log(cliffy.colors.brightGreen("Database has been moved"));
  });
