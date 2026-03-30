import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";
import { REGIONS } from "../../types.js";

export function registerUpdateRegions(redis: Command): void {
  redis
    .command("update-regions")
    .description("Update read replica regions for a Redis database")
    .requiredOption("--db-id <id>", "Database ID")
    .requiredOption("--read-regions <regions...>", `Read replica regions. Available: ${REGIONS.join(", ")}`)
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { dbId: string; readRegions: string[]; email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      try {
        const result = await request(auth, "POST", `/v2/redis/update-regions/${flags.dbId}`, { read_regions: flags.readRegions });
        printJSON(result);
      } catch (err) {
        handleError(err);
      }
    });
}
