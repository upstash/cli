import { cliffy } from "../../deps.ts";
import { Command } from "../../util/command.ts";
import { parseAuth } from "../../util/auth.ts";
import { http } from "../../util/http.ts";

export const createCmd = new Command()
  .name("create")
  .description("Create a new team")
  .option("-n --name <string>", "Name of the database")
  .option(
    "--copy-credit-card <boolean:boolean>",
    "Set true to copy the credit card information to the new team",
    { default: false },
  )
  .action(async (options): Promise<void> => {
    const authorization = await parseAuth(options);

    if (!options.name) {
      if (options.ci) {
        throw new cliffy.ValidationError("name");
      }
      options.name = await cliffy.Input.prompt("Set a name for your team");
    }

    const body: Record<string, string | number | boolean | undefined> = {
      team_name: options.name,
      copy_cc: options.copyCreditCard,
    };

    const team = await http.request<Response>({
      method: "POST",
      authorization,
      path: ["v2", "team"],
      body,
    });
    if (options.json) {
      console.log(JSON.stringify(team, null, 2));
      return;
    }
    console.log(cliffy.colors.brightGreen("Team has been created"));
    console.log();
    console.log(
      cliffy.Table.from(
        Object.entries(team).map(([k, v]) => [k.toString(), v.toString()]),
      ).toString(),
    );
  });
