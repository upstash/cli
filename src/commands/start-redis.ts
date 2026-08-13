import { Command } from "commander";
import { plainError } from "../output.js";

const START_REDIS_URL = "https://upstash.com/start-redis";
const DEFAULT_USER_AGENT = "upstash/cli";

export function registerStartRedis(program: Command): void {
  program
    .command("start-redis")
    .description(
      "Get a free temporary Redis database — no account or API key needed. Prints markdown with credentials and a quickstart. Expires in 72 hours; claim it with an Upstash account to keep it.",
    )
    .option("--id <id>", "Re-fetch the credentials of a database created earlier")
    .option(
      "--user-agent <name>",
      "Identify the caller. If you are an agent, pass your own name (e.g. claude-code, cursor, codex, opencode)",
    )
    .action(async (flags: { id?: string; userAgent?: string }) => {
      const headers: Record<string, string> = {
        "User-Agent": flags.userAgent || DEFAULT_USER_AGENT,
      };
      if (flags.id) {
        headers["Idempotency-Key"] = flags.id;
      }

      // This command's output is markdown, not JSON, so network failures are
      // reported as plain text too rather than through the JSON error path.
      let response: Response;
      let text: string;
      try {
        response = await fetch(START_REDIS_URL, {
          method: "POST",
          headers,
        });
        text = await response.text();
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw plainError(`Could not reach ${START_REDIS_URL}: ${reason}`);
      }

      if (!response.ok) {
        throw plainError(text || `HTTP ${response.status}`);
      }

      console.log(text.trimEnd());
    });
}
