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
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { email?: string; apiKey?: string; name: string; region: string; readRegions?: string[] }) => {
      if (!(REGIONS as readonly string[]).includes(flags.region)) {
        throw new Error(`Invalid region '${flags.region}'. Available: ${REGIONS.join(", ")}`);
      }
      const auth = resolveAuth(flags);
      const db = await request<Database>(auth, "POST", "/v2/redis/database", {
        database_name: flags.name,
        region: "global",
        primary_region: flags.region,
        read_regions: flags.readRegions,
      });
      printJSON(db);
    });
}
