import { cliffy } from "../../deps.ts";
import { Command } from "../../util/command.ts";
import { parseAuth } from "../../util/auth.ts";
import { http } from "../../util/http.ts";
import type { Database } from "./types.ts";
export const deleteCmd = new Command()
  .name("delete")
  .description("delete a redis database")
  .option("--id=<string>", "The uuid of the cluster")
  .example("Delete", `upstash redis delete ${crypto.randomUUID()}`)
  .action(async (options): Promise<void> => {
    const authorization = await parseAuth(options);

    if (!options.id) {
      if (options.ci) {
        throw new cliffy.ValidationError("id");
      }
      const dbs = await http.request<Database[]>({
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

    await http.request<Response>({
      method: "DELETE",
      authorization,
      path: ["v2", "redis", "database", options.id!],
    });
    if (options.json) {
      console.log(JSON.stringify({ ok: true }, null, 2));
      return;
    }
    console.log(cliffy.colors.brightGreen("Database has been deleted"));
    console.log();
  });
