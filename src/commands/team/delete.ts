import { cliffy } from "../../deps.ts";
import { Command } from "../../util/command.ts";
import { parseAuth } from "../../util/auth.ts";
import { http } from "../../util/http.ts";
export const deleteCmd = new Command()
  .name("delete")
  .description("delete a team")
  .option("--id <id:string>", "The uuid of your database")
  .example("Delete", `upstash team delete ${crypto.randomUUID()}`)
  .action(async (options): Promise<void> => {
    const authorization = await parseAuth(options);

    if (!options.id) {
      if (options.ci) {
        throw new cliffy.ValidationError("id");
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

    await http.request<Response>({
      method: "DELETE",
      authorization,
      path: ["v2", "team", options.id!],
    });
    if (options.json) {
      console.log(JSON.stringify({ ok: true }, null, 2));
      return;
    }
    console.log(cliffy.colors.brightGreen("Team has been deleted"));
    console.log();
  });
