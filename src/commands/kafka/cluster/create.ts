import { cliffy } from "../../../deps.ts";
import { Command } from "../../../util/command.ts";
import { parseAuth } from "../../../util/auth.ts";
import { http } from "../../../util/http.ts";
import type { Cluster } from "./types.ts";
enum Region {
  "eu-west-1" = "eu-west-1",
  "us-east-1" = "us-east-1",
}

export const createCmd = new Command()
  .name("create")
  .description("Create a new kafka cluster")
  .option("-n --name <string>", "Name of the cluster", { required: true })
  .type("region", new cliffy.EnumType(Region))
  .option("-r --region <string:region>", "Region of the database", {
    required: true,
  })
  .option(
    "--multizone-replication <boolean:boolean>",
    "Set true to enable multizone-replication",
    { default: false },
  )
  .example(
    "region",
    "upstash kafka cluster create --name prod --region=us-east-1",
  )
  .action(async (options): Promise<void> => {
    const authorization = await parseAuth(options);

    if (!options.name) {
      if (options.ci) {
        throw new cliffy.ValidationError("name");
      }
      options.name = await cliffy.Input.prompt("Set a name for your cluster");
    }

    // if (!options.region) {
    //   if (options.ci) {
    //     throw new cliffy.ValidationError("region");
    //   }
    //   options.region = (await cliffy.Select.prompt({
    //     message: "Select a region",
    //     options: Object.entries(Region).map(([name, value]) => ({
    //       name,
    //       value,
    //     })),
    //   })) as Region;
    // }
    const body: Record<string, string | number | boolean | undefined> = {
      name: options.name,
      region: options.region,
      multizone: options.multizoneReplication,
    };

    const cluster = await http.request<Cluster>({
      method: "POST",
      authorization,
      path: ["v2", "kafka", "cluster"],
      body,
    });
    if (options.json) {
      console.log(JSON.stringify(cluster, null, 2));
      return;
    }
    console.log(cliffy.colors.brightGreen("Cluster has been created"));
    console.log();
    console.log(
      cliffy.Table.from(
        Object.entries(cluster).map(([k, v]) => [k.toString(), v.toString()]),
      ).toString(),
    );
    console.log();
    console.log();

    console.log(
      "Go to your cluster: " +
        cliffy.colors.yellow(
          "https://console.upstash.com/kafka/" + cluster.cluster_id,
        ),
    );
  });
