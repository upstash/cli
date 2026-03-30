import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";
import { REGIONS } from "../../types.js";

interface Flags {
  email?: string;
  apiKey?: string;
  json?: boolean;
  readRegions: string[];
}

export function registerUpdateRegions(redis: Command): void {
  redis
    .command("update-regions <database-id>")
    .description("Update read replica regions for a Redis database")
    .requiredOption(
      "--read-regions <regions...>",
      `Read replica regions (space-separated). Available: ${REGIONS.join(", ")}`,
    )
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (databaseId: string, flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        await request(auth, "POST", `/v2/redis/update-regions/${databaseId}`, {
          read_regions: flags.readRegions,
        });
        if (flags.json) {
          printJSON({
            success: true,
            database_id: databaseId,
            read_regions: flags.readRegions,
          });
          return;
        }
        console.log(`Read regions updated: ${flags.readRegions.join(", ")}`);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
