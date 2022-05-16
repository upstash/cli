import { cliffy } from "../../../deps.ts";
import { Command } from "../../../util/command.ts";
import { parseAuth } from "../../../util/auth.ts";
import { http } from "../../../util/http.ts";
import type { Cluster } from "./types.ts";

export const statsCmd = new Command()
  .name("stats")
  .description("get usage information about a kafka clusters")
  .option("--id=<string>", "The id of your cluster")
  .example("Get", `upstash kafka cluster stats ${crypto.randomUUID}`)
  .action(async (options): Promise<void> => {
    const authorization = await parseAuth(options);

    if (!options.id) {
      if (options.ci) {
        throw new cliffy.ValidationError("id");
      }
      const clusters = await http.request<Cluster[]>({
        method: "GET",
        authorization,
        path: ["v2", "kafka", "clusters"],
      });
      options.id = await cliffy.Select.prompt({
        message: "Select a cluster",
        options: clusters.map(({ name, cluster_id }) => ({
          name: name,
          value: cluster_id,
        })),
      });
    }

    const stats = await http.request<Cluster[]>({
      method: "GET",
      authorization,
      path: ["v2", "kafka", "stats", "cluster", options.id],
    });

    console.log(JSON.stringify(stats, null, 2));
  });
