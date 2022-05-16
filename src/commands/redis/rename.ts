import { cliffy } from "../../deps.ts";
import { Command } from "../../util/command.ts";
import { parseAuth } from "../../util/auth.ts";
import { http } from "../../util/http.ts";
export const renameCmd = new Command()
  .name("rename")
  .description("Rename a redis database")
  .option("--id=<string>", "The id of your database", { required: true })
  .option("--name=<string>", "Choose a new name", { required: true })
  .example(
    "Rename",
    `upstash redis rename f860e7e2-27b8-4166-90d5-ea41e90b4809`,
  )
  .action(async (options): Promise<void> => {
    const authorization = await parseAuth(options);

    // if (!options.id) {
    //   if (options.ci) {
    //     throw new cliffy.ValidationError("id");
    //   }
    //   const dbs = await http.request<
    //     { database_name: string; database_id: string }[]
    //   >({
    //     method: "GET",
    //     authorization,
    //     path: ["v2", "redis", "databases"],
    //   });
    //   options.id = await cliffy.Select.prompt({
    //     message: "Select a database to rename",
    //     options: dbs.map(({ database_name, database_id }) => ({
    //       name: database_name,
    //       value: database_id,
    //     })),
    //   });
    // }

    // if (!options.name) {
    //   if (options.ci) {
    //     throw new cliffy.ValidationError("id");
    //   }
    //   options.name = await cliffy.Input.prompt({
    //     message: "Choose a new name",
    //   });
    // }
    const db = await http.request<Response>({
      method: "POST",
      authorization,
      path: ["v2", "redis", "rename", options.id!],
      body: {
        name: options.name,
      },
    });
    if (options.json) {
      console.log(JSON.stringify(db, null, 2));
      return;
    }
    console.log(cliffy.colors.brightGreen("Database has been renamed"));
  });
