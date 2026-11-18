import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import { REGIONS } from "../../types.js";
import type { Database } from "../../types.js";

export function registerCreate(redis: Command): void {
  redis
    .command("create")
    .description("Create a new Redis database")
    .requiredOption("--name <name>", "Database name")
    .requiredOption("--region <region>", `Primary region. Available: ${REGIONS.join(", ")}`)
    .option("--read-regions <regions...>", "Read replica regions (space-separated)")
    .action(async (flags: { name: string; region: string; readRegions?: string[] }, command: Command) => {
      const auth = resolveAuth(command);
      const db = await request<Database>(auth, "POST", "/v2/redis/database", {
        database_name: flags.name,
        region: "global",
        primary_region: flags.region,
        read_regions: flags.readRegions,
      });
      printJSON(db);
    });
}
