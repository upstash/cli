import { cliffy } from "../../deps.ts";
import { Command } from "../../util/command.ts";
import { parseAuth } from "../../util/auth.ts";
import { http } from "../../util/http.ts";

export const renameCmd = new Command()
  .name("rename")
  .description("Rename a redis database")
  .arguments("[id] [name]")
  .example("Rename", `upstash redis rename ${crypto.randomUUID()}`)
  .action(async (options, id, name): Promise<void> => {
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

    if (!name) {
      name = await cliffy.Input.prompt({
        message: "Choose a new name",
      });
    }
    const db = await http.request<Response>({
      method: "POST",
      authorization,
      path: ["v2", "redis", "rename", id!],
      body: {
        name,
      },
    });
    if (options.json) {
      console.log(JSON.stringify(db, null, 2));
      return;
    }
    console.log(cliffy.colors.brightGreen("Database has been renamed"));
  });
