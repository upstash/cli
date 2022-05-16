import { cliffy } from "../../deps.ts";
import { Command } from "../../util/command.ts";
import { parseAuth } from "../../util/auth.ts";
import { http } from "../../util/http.ts";
import type { Database } from "./types.ts";

export const getCmd = new Command()
  .name("get")
  .description("get a redis database")
  .option("--id=<string>", "The id of your database")
  .example("Get", `upstash redis get ${crypto.randomUUID()}`)
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
        message: "Select a database to delete",
        options: dbs.map(({ database_name, database_id }) => ({
          name: database_name,
          value: database_id,
        })),
      });
    }

    const db = await http.request<Database>({
      method: "GET",
      authorization,
      path: ["v2", "redis", "database", options.id!],
    });
    if (options.json) {
      console.log(JSON.stringify(db, null, 2));
      return;
    }

    console.log(
      cliffy.Table.from(
        Object.entries(db).map(([k, v]) => [k.toString(), v.toString()]),
      ).toString(),
    );
  });
