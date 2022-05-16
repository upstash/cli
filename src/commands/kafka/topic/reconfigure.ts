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

import type { Cluster } from "../cluster/types.ts";
export const reconfigureCmd = new Command()
  .name("reconfigure")
  .description("Reconfigure a kafka topic")
  .option("--id=<string>", "The id of your topic")
  .type("retention-time", new cliffy.EnumType(retentionTime))
  .type("retention-size", new cliffy.EnumType(retentionSize))
  .type("max-message-size", new cliffy.EnumType(maxMessageSize))
  .type("cleanup-policy", new cliffy.EnumType(cleanupPolicy))
  .option(
    "--retention-time <string:retention-time>",
    "Retention time of messsages in the topic",
  )
  .option(
    "--retention-size <string:retention-size>",
    "Retention size of messsages in the topic",
  )
  .option(
    "--max-message-size <string:max-message-size>",
    "Maxinum size of messsages in the topic",
  )
  .example(
    "Create",
    `upstash kafka topic reconfigure --topic-id=${crypto.randomUUID()} --retention-time="1week"`,
  )
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

      const clusterID = await cliffy.Select.prompt({
        message: "Select a cluster",
        options: clusters.map(({ name, cluster_id }) => ({
          name: name,
          value: cluster_id,
        })),
      });
      const topics = await http.request<Topic[]>({
        method: "GET",
        authorization,
        path: ["v2", "kafka", "topics", clusterID],
      });
      options.id = await cliffy.Select.prompt({
        message: "Select a topic",
        options: topics.map((t) => ({
          name: t.topic_name,
          value: t.topic_id,
        })),
      });
    }
    if (!options.retentionTime) {
      if (options.ci) {
        throw new cliffy.ValidationError("retentionTime");
      }

      options.retentionTime = parseInt(
        await cliffy.Select.prompt({
          message: "Change Retention Time",

          options: Object.entries(retentionTime).map(([name, value]) => ({
            name,
            value: value.toString(),
          })),
        }),
      );
    }
    if (!options.retentionSize) {
      if (options.ci) {
        throw new cliffy.ValidationError("retentionSize");
      }

      options.retentionSize = parseInt(
        await cliffy.Select.prompt({
          message: "Change Retention Size",

          options: Object.entries(retentionSize).map(([name, value]) => ({
            name,
            value: value.toString(),
          })),
        }),
      );
    }
    if (!options.maxMessageSize) {
      if (options.ci) {
        throw new cliffy.ValidationError("maxMessageSize");
      }

      options.maxMessageSize = parseInt(
        await cliffy.Select.prompt({
          message: "Change maximum message size",

          options: Object.entries(maxMessageSize).map(([name, value]) => ({
            name,
            value: value.toString(),
          })),
        }),
      );
    }

    const body: Record<string, number> = {};
    if (options.retentionTime) {
      body.retention_time = options.retentionTime;
    }
    if (options.retentionSize) {
      body.retention_size = options.retentionSize;
    }
    if (options.maxMessageSize) {
      body.max_message_size = options.maxMessageSize;
    }

    const topic = await http.request<Topic>({
      method: "POST",
      authorization,
      path: ["v2", "kafka", "update-topic", options.id],
      body,
    });
    if (options.json) {
      console.log(JSON.stringify(topic, null, 2));
      return;
    }
    console.log(cliffy.colors.brightGreen("Topic has been reconfigured"));
    console.log();
    console.log(
      cliffy.Table.from(
        Object.entries(topic).map(([k, v]) => [k.toString(), v.toString()]),
      ).toString(),
    );
  });
