import { cliffy } from "../../../deps.ts";
import { Command } from "../../../util/command.ts";
import { parseAuth } from "../../../util/auth.ts";
import { http } from "../../../util/http.ts";
import type { Cluster } from "./types.ts";

export const listCmd = new Command()
  .name("list")
  .description("list all your kafka clusters")
  .example("List", "upstash redis list")
  .action(async (options): Promise<void> => {
    const authorization = await parseAuth(options);

    const clusters = await http.request<Cluster[]>({
      method: "GET",
      authorization,
      path: ["v2", "kafka", "clusters"],
    });
    if (options.json) {
      console.log(JSON.stringify(clusters, null, 2));
      return;
    }

    clusters.forEach((cluster) => {
      console.log();
      console.log();
      console.log(
        cliffy.colors.underline(cliffy.colors.brightGreen(cluster.name)),
      );
      console.log();
      console.log(
        cliffy.Table.from(
          Object.entries(cluster).map(([k, v]) => [k.toString(), v.toString()]),
        ).toString(),
      );
    });
  });
