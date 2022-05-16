import { cliffy } from "../../../deps.ts";
import { Command } from "../../../util/command.ts";
import { parseAuth } from "../../../util/auth.ts";
import { http } from "../../../util/http.ts";
import type { Topic } from "./types.ts";
// import type { Cluster } from "../cluster/types.ts";
export const getCmd = new Command()
  .name("get")
  .description("get information about a kafka topic")
  .option("--id=<string>", "The id of your topic", { required: true })
  .example(
    "Get",
    `upstash kafka topic --id=f860e7e2-27b8-4166-90d5-ea41e90b4809`,
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

    //   const clusterID = await cliffy.Select.prompt({
    //     message: "Select a cluster",
    //     options: clusters.map(({ name, cluster_id }) => ({
    //       name: name,
    //       value: cluster_id,
    //     })),
    //   });
    //   const topics = await http.request<Topic[]>({
    //     method: "GET",
    //     authorization,
    //     path: ["v2", "kafka", "topics", clusterID],
    //   });
    //   options.id = await cliffy.Select.prompt({
    //     message: "Select a topic",
    //     options: topics.map((t) => ({
    //       name: t.topic_name,
    //       value: t.topic_id,
    //     })),
    //   });
    // }
    const topic = await http.request<Topic>({
      method: "GET",
      authorization,
      path: ["v2", "kafka", "topic", options.id],
    });
    if (options.json) {
      console.log(JSON.stringify(topic, null, 2));
      return;
    }

    console.log(
      cliffy.Table.from(
        Object.entries(topic).map(([k, v]) => [k.toString(), v.toString()]),
      ).toString(),
    );
  });
