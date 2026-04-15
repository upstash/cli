import { Command } from "commander";
import { resolveAuth } from "../../../auth.js";
import { request } from "../../../client.js";
import { printJSON } from "../../../output.js";

export function registerDisableDaily(backup: Command): void {
  backup
    .command("disable-daily")
    .description("Disable daily automatic backups for a Redis database")
    .requiredOption("--db-id <id>", "Database ID")
    .action(async (flags: { dbId: string }, command: Command) => {
      const auth = resolveAuth(command);
      const result = await request(auth, "POST", `/v2/redis/disable-dailybackup/${flags.dbId}`);
      printJSON(result);
    });
}
