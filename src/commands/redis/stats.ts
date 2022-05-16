// import { cliffy } from "../../deps.ts";
import { Command } from "../../util/command.ts";
import { parseAuth } from "../../util/auth.ts";
import { http } from "../../util/http.ts";
import type { Database } from "./types.ts";
export const statsCmd = new Command()
  .name("stats")
  .description("Returns detailed information about the databse usage")
  .option("--id=<string>", "The id of your database", { required: true })
  .example(
    "Get",
    `upstash redis stats --id=f860e7e2-27b8-4166-90d5-ea41e90b4809`,
  )
  .action(async (options): Promise<void> => {
    const authorization = await parseAuth(options);

    // if (!options.id) {
    //   const dbs = await http.request<
    //     { database_name: string; database_id: string }[]
    //   >({
    //     method: "GET",
    //     authorization,
    //     path: ["v2", "redis", "databases"],
    //   });
    //   options.id = await cliffy.Select.prompt({
    //     message: "Select a database to delete",
    //     options: dbs.map(({ database_name, database_id }) => ({
    //       name: database_name,
    //       value: database_id,
    //     })),
    //   });
    // }

    const db = await http.request<Database>({
      method: "GET",
      authorization,
      path: ["v2", "redis", "stats", options.id!],
    });
    console.log(JSON.stringify(db, null, 2));
    return;
  });
