import { cliffy } from "../../../deps.ts";
import { Command } from "../../../util/command.ts";
import { parseAuth } from "../../../util/auth.ts";
import { http } from "../../../util/http.ts";
import type { Cluster } from "./types.ts";
export const resetPasswordCmd = new Command()
  .name("reset-password")
  .description("reset the password of a kafka cluster")
  .option("--id=<string>", "The id of your cluster")
  .example(
    "Reset",
    `upstash kafka cluster reset-password ${crypto.randomUUID()}`,
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
      options.id = await cliffy.Select.prompt({
        message: "Select a cluster",
        options: clusters.map((c) => ({
          name: c.name,
          value: c.cluster_id,
        })),
      });
    }

    const db = await http.request<Response>({
      method: "POST",
      authorization,
      path: ["v2", "kafka", "reset-password", options.id!],
    });
    if (options.json) {
      console.log(JSON.stringify(db, null, 2));
      return;
    }
    console.log(cliffy.colors.brightGreen("Cluster password has been reset"));
    console.log();
    console.log(
      cliffy.Table.from(
        Object.entries(db).map(([k, v]) => [k.toString(), v.toString()]),
      ).toString(),
    );
  });
