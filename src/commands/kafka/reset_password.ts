import { cliffy } from "../../deps.ts";
import { Command } from "../../util/command.ts";
import { parseAuth } from "../../util/auth.ts";
import { http } from "../../util/http.ts";
export enum Region {
  global = "global",
  "us-west-1" = "us-west-1",
  "us-west-2" = "us-west-2",
  "eu-west-1" = "eu-west-1",
  "us-east-1" = "us-east-1",
  "ap-northeast-1" = "ap-northeast-1",
  "us-central-1" = "us-central-1",
}

// Not exhaustive, but that's all we need
type Response = {
  database_id: string;
  password: string;
  endpoint: string;
  port: number;
  tls: boolean;
};

export const resetPasswordCmd = new Command()
  .name("reset-password")
  .description("reset the password of a redis database")
  .arguments("[id]")
  .example("Reset", `upstash redis reset-password ${crypto.randomUUID()}`)
  .action(async (options, id): Promise<void> => {
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
        message: "Select a database to delete",
        options: dbs.map(({ database_name, database_id }) => ({
          name: database_name,
          value: database_id,
        })),
      });
    }

    const db = await http.request<Response>({
      method: "POST",
      authorization,
      path: ["v2", "redis", "reset-password", id!],
    });
    if (options.json) {
      console.log(JSON.stringify(db, null, 2));
      return;
    }
    console.log(cliffy.colors.brightGreen("Database password has been reset"));
    console.log();
    console.log(
      cliffy.Table.from(
        Object.entries(db).map(([k, v]) => [k.toString(), v.toString()]),
      ).toString(),
    );
  });
