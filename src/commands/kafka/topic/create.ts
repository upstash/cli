import { cliffy } from "../../../deps.ts";
import { Command } from "../../../util/command.ts";
import { parseAuth } from "../../../util/auth.ts";
import { http } from "../../../util/http.ts";
import {
  cleanupPolicy,
  maxMessageSize,
  retentionSize,
  retentionTime,
  Topic,
} from "./types.ts";

export const createCmd = new Command()
  .name("create")
  .description("Create a new kafka topic")
  .option("-n, --name <string>", "Name of the topic")
  .option("-c, --cluster-id <string>", "id of the kafka cluster")
  .option(
    "-p, --partitions <number>",
    "The number of partitions the topic will have",
    { default: 1 },
  )
  .type("retention-time", new cliffy.EnumType(retentionTime))
  .type("retention-size", new cliffy.EnumType(retentionSize))
  .type("max-message-size", new cliffy.EnumType(maxMessageSize))
  .type("cleanup-policy", new cliffy.EnumType(cleanupPolicy))
  .option(
    "--retention-time <string:retention-time>",
    "Retention time of messsages in the topic",
    { default: retentionTime["1week"] },
  )
  .option(
    "--retention-size <string:retention-size>",
    "Retention size of messsages in the topic",
    { default: retentionSize["1gb"] },
  )
  .option(
    "--max-message-size <string:max-message-size>",
    "Maxinum size of messsages in the topic",
    { default: maxMessageSize["1mb"] },
  )
  .option(
    "--multizone-replication [boolean]",
    "Set true to enable multizone-replication",
    { default: false },
  )
  .option(
    "--cleanup-policy <string:cleanup-policy>",
    "Cleanup policy will be used in the topic(compact or delete)",
    { default: cleanupPolicy.delete },
  )
  .example(
    "Create",
    `upstash kafka topic create --cluster-id=${crypto.randomUUID()} --name=billing`,
  )
  .action(async (options): Promise<void> => {
    const authorization = await parseAuth(options);

    if (!options.name) {
      if (options.ci) {
        throw new cliffy.ValidationError("name");
      }
      options.name = await cliffy.Input.prompt("Set a name for your topic");
    }

    const topic = await http.request<Topic>({
      method: "POST",
      authorization,
      path: ["v2", "kafka", "cluster"],
      body: {
        name: options.name,
        partitions: options.partitions,
        retention_time: options.retentionTime,
        retention_size: options.retentionSize,
        max_message_size: options.maxMessageSize,
        cleanup_policy: options.cleanupPolicy,
        cluster_id: options.clusterId,
      },
    });
    if (options.json) {
      console.log(JSON.stringify(topic, null, 2));
      return;
    }
    console.log(cliffy.colors.brightGreen("Topic has been created"));
    console.log();
    console.log(
      cliffy.Table.from(
        Object.entries(topic).map(([k, v]) => [k.toString(), v.toString()]),
      ).toString(),
    );
    console.log();
    console.log();

    console.log(
      "Go to your cluster: " +
        cliffy.colors.yellow(
          "https://console.upstash.com/kafka/" + topic.cluster_id,
        ),
    );
  });
