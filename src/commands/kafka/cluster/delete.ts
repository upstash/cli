import { cliffy } from "../../../deps.ts";
import { Command } from "../../../util/command.ts";
import { parseAuth } from "../../../util/auth.ts";
import { http } from "../../../util/http.ts";
import type { Cluster } from "./types.ts";
// Not exhaustive, but that's all we need
type Response = {
  database_id: string;
  password: string;
  endpoint: string;
  port: number;
  tls: boolean;
};

export const deleteCmd = new Command()
  .name("delete")
  .description("delete a cluster")
  .option("--id=<string>", "The id of your cluster")
  .example("Delete", `upstash kafka cluster delete ${crypto.randomUUID()}`)
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

    await http.request<Response>({
      method: "DELETE",
      authorization,
      path: ["v2", "kafka", "clusters", options.id!],
    });
    if (options.json) {
      console.log(JSON.stringify({ ok: true }, null, 2));
      return;
    }
    console.log(cliffy.colors.brightGreen("Cluster has been deleted"));
    console.log();
  });
