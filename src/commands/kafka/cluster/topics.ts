import { cliffy } from "../../../deps.ts";
import { Command } from "../../../util/command.ts";
import { parseAuth } from "../../../util/auth.ts";
import { http } from "../../../util/http.ts";
// import type { Cluster } from "./types.ts";
import type { Topic } from "../topic/types.ts";
export const topicsCmd = new Command()
  .name("topics")
  .description("list kafka topics in cluster")
  .option("--id=<string>", "The id of your cluster", { required: true })
  .example("Get", `upstash kafka topic f860e7e2-27b8-4166-90d5-ea41e90b4809`)
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
    //     message: "Select a cluster",
    //     options: clusters.map(({ name, cluster_id }) => ({
    //       name: name,
    //       value: cluster_id,
    //     })),
    //   });
    // }
    const topics = await http.request<Topic[]>({
      method: "GET",
      authorization,
      path: ["v2", "kafka", "topics", options.id],
    });
    if (options.json) {
      console.log(JSON.stringify(topics, null, 2));
      return;
    }

    topics.forEach((topic) => {
      console.log(
        cliffy.Table.from(
          Object.entries(topic).map(([k, v]) => [k.toString(), v.toString()]),
        ).toString(),
      );
    });
  });
