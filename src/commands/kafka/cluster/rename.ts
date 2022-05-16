import { cliffy } from "../../../deps.ts";
import { Command } from "../../../util/command.ts";
import { parseAuth } from "../../../util/auth.ts";
import { http } from "../../../util/http.ts";
// import type { Cluster } from "./types.ts";

export const renameCmd = new Command()
  .name("rename")
  .description("Rename a kafka cluster")
  .option("--id=<string>", "The id of your cluster", { required: true })
  .option("--name=<string>", "The name of your cluster", { required: true })
  .example(
    "Rename",
    `upstash kafka cluster rename f860e7e2-27b8-4166-90d5-ea41e90b4809 new-name`,
  )
  .action(async (options): Promise<void> => {
    const authorization = await parseAuth(options);

    // if (!options.id) {
    //   if (options.ci) {
    //     throw new cliffy.ValidationError("id");
    //   }
    //   const clusters = await http.request<Cluster[]>({
    //     method: "GET",
    //     authorization,
    //     path: ["v2", "kafka", "clusters"],
    //   });
    //   options.id = await cliffy.Select.prompt({
    //     message: "Select a cluster to rename",
    //     options: clusters.map((c) => ({
    //       name: c.name,
    //       value: c.cluster_id,
    //     })),
    //   });
    // }

    // if (!options.name) {
    //   options.name = await cliffy.Input.prompt({
    //     message: "Choose a new name",
    //   });
    // }
    const db = await http.request<Response>({
      method: "POST",
      authorization,
      path: ["v2", "kafka", "rename-cluster", options.id!],
      body: {
        name: options.name,
      },
    });
    if (options.json) {
      console.log(JSON.stringify(db, null, 2));
      return;
    }
    console.log(cliffy.colors.brightGreen("Cluster has been renamed"));
  });
