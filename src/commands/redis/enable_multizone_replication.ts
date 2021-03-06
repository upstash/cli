import { cliffy } from "../../deps.ts";
import { Command } from "../../util/command.ts";
import { parseAuth } from "../../util/auth.ts";
import { http } from "../../util/http.ts";

export const enableMultizoneReplicationCmd = new Command()
  .name("enable-multizone-replication")
  .description("Enable multizone replication for a redis database")
  .option("--id=<string>", "The id of your database", { required: true })
  .example(
    "Enable",
    `upstash redis enable-multizone-replication f860e7e2-27b8-4166-90d5-ea41e90b4809`,
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

    const db = await http.request<Response>({
      method: "POST",
      authorization,
      path: ["v2", "redis", "enable-multizone", options.id!],
    });
    if (options.json) {
      console.log(JSON.stringify(db, null, 2));
      return;
    }
    console.log(
      cliffy.colors.brightGreen("Multizone replication has been enabled"),
    );
  });
