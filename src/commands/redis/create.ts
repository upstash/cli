import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, printKeyValue, handleError } from "../../output.js";
import { REGIONS } from "../../types.js";
import type { Database } from "../../types.js";

interface Flags {
  email?: string;
  apiKey?: string;
  json?: boolean;
  name: string;
  region: string;
  readRegions?: string[];
}

export function registerCreate(redis: Command): void {
  redis
    .command("create")
    .description("Create a new Redis database")
    .requiredOption("--name <name>", "Database name")
    .requiredOption(
      "--region <region>",
      `Primary region. Available: ${REGIONS.join(", ")}`,
    )
    .option("--read-regions <regions...>", "Read replica regions (space-separated)")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (flags: Flags) => {
      if (!(REGIONS as readonly string[]).includes(flags.region)) {
        console.error(
          `Error: Invalid region '${flags.region}'.\nAvailable: ${REGIONS.join(", ")}`,
        );
        process.exit(1);
      }

      const auth = resolveAuth(flags);
      try {
        const db = await request<Database>(auth, "POST", "/v2/redis/database", {
          database_name: flags.name,
          region: "global",
          primary_region: flags.region,
          read_regions: flags.readRegions,
        });
        if (flags.json) {
          printJSON(db);
          return;
        }
        console.log(`Database '${db.database_name}' created.`);
        console.log();
        printKeyValue(db as unknown as Record<string, unknown>);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
