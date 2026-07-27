import { Command } from "commander";
import { plainError } from "../output.js";

const START_REDIS_URL = "https://upstash.com/start-redis";

export function registerStartRedis(program: Command): void {
  program
    .command("start-redis")
    .description(
      "Get a free temporary Redis database — no account or API key needed. Prints markdown with credentials and a quickstart. Expires in 72 hours; claim it with an Upstash account to keep it.",
    )
    .option("--id <id>", "Re-fetch the credentials of a database created earlier")
    .action(async (flags: { id?: string }) => {
      const response = await fetch(START_REDIS_URL, {
        method: "POST",
        headers: flags.id ? { "Idempotency-Key": flags.id } : undefined,
      });

      const text = await response.text();

      if (!response.ok) {
        throw plainError(text || `HTTP ${response.status}`);
      }

      console.log(text.trimEnd());
    });
}
