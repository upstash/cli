import { cliffy } from "../../deps.ts";
import { Command } from "../../util/command.ts";
import { parseAuth } from "../../util/auth.ts";
import { http } from "../../util/http.ts";
import type { Database } from "./types.ts";
export enum Region {
  global = "global",
  "us-west-1" = "us-west-1",
  "us-west-2" = "us-west-2",
  "eu-west-1" = "eu-west-1",
  "us-east-1" = "us-east-1",
  "ap-northeast-1" = "ap-northeast-1",
  "us-central1" = "us-central1",
}

export const createCmd = new Command()
  .name("create")
  .description("Create a new redis database")
  .option("-n --name <string>", "Name of the database")
  .type("region", new cliffy.EnumType(Region))
  .option("-r --region <string:region>", "Region of the database")
  .option("--tls [boolean]", "Set true to enable tls", { default: true })
  .option(
    "--multizone-replication [boolean]",
    "Set true to enable multizone-replication",
    { default: false },
  )
  .option(
    "-c --consistent [boolean]",
    "Set true to enable strong consistency",
    { default: false },
  )
  .example("region", "upstash create --name mydb --region=us-east-1")
  .example("global", "upstash create --name mydb --region=global")
  .action(async (options): Promise<void> => {
    const authorization = await parseAuth(options);

    if (!options.name) {
      if (options.ci) {
        throw new cliffy.ValidationError("name");
      }
      options.name = await cliffy.Input.prompt("Set a name for your database");
    }

    if (!options.region) {
      if (options.ci) {
        throw new cliffy.ValidationError("region");
      }
      options.region = (await cliffy.Select.prompt({
        message: "Select a region",
        options: Object.entries(Region).map(([name, value]) => ({
          name,
          value,
        })),
      })) as Region;
    }
    const body: Record<string, string | number | boolean | undefined> = {
      database_name: options.name,
      region: options.region,
      tls: options.tls,
      multizone: options.multizoneReplication,
      consistent: options.consistent,
    };

    const db = await http.request<Database>({
      method: "POST",
      authorization,
      path: ["v2", "redis", "database"],
      body,
    });
    if (options.json) {
      console.log(JSON.stringify(db, null, 2));
      return;
    }
    console.log(cliffy.colors.brightGreen("Database has been created"));
    console.log();
    console.log(
      cliffy.Table.from(
        Object.entries(db).map(([k, v]) => [k.toString(), v.toString()]),
      ).toString(),
    );
    console.log();
    console.log();

    console.log(
      "You can visit your database details page: " +
        cliffy.colors.yellow(
          "https://console.upstash.com/redis/" + db.database_id,
        ),
    );
    console.log();
    console.log(
      "Connect to your database with redis-cli: " +
        cliffy.colors.yellow(
          `redis-cli${
            db.tls ? " --tls" : ""
          } -u redis://${db.password}@${db.endpoint}:${db.port}`,
        ),
    );
  });
