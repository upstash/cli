import { Command } from "commander";
import { resolveAuth } from "../../../auth.js";
import { request } from "../../../client.js";
import { printJSON, handleError } from "../../../output.js";

interface Flags {
  email?: string;
  apiKey?: string;
  json?: boolean;
}

export function registerEnableDaily(backup: Command): void {
  backup
    .command("enable-daily <database-id>")
    .description("Enable daily automatic backups for a Redis database")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (databaseId: string, flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        await request(auth, "POST", `/v2/redis/enable-dailybackup/${databaseId}`);
        if (flags.json) {
          printJSON({ success: true, database_id: databaseId });
          return;
        }
        console.log("Daily backup enabled.");
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
