import { Command } from "commander";
import { printJSON } from "../../output.js";

interface Flags {
  dbUrl?: string;
  dbToken?: string;
  json?: string;
}

export function registerExec(redis: Command): void {
  redis
    .command("exec")
    .description(
      "Execute a Redis command against a database via the REST API. " +
      "Pass args as positional tokens (shell handles quoting) or via --json."
    )
    .option("--db-url <url>", "Database REST URL (overrides UPSTASH_REDIS_REST_URL)")
    .option("--db-token <token>", "Database REST token (overrides UPSTASH_REDIS_REST_TOKEN)")
    .option("--json <json>", 'Redis command args as a JSON array (e.g. \'["SET","key","val"]\')')
    .argument("[args...]", "Command tokens (e.g. SET key value)")
    .action(async (positional: string[], flags: Flags) => {
      const dbUrl = flags.dbUrl ?? process.env.UPSTASH_REDIS_REST_URL;
      const dbToken = flags.dbToken ?? process.env.UPSTASH_REDIS_REST_TOKEN;

      if (!dbUrl || !dbToken) {
        throw new Error(
          "Database credentials required. Provide --db-url and --db-token or set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables."
        );
      }

      if (positional.length > 0 && flags.json) {
        throw new Error("Provide either positional args or --json, not both.");
      }

      const args = flags.json ? parseJsonArgs(flags.json) : positional;
      if (args.length === 0) {
        throw new Error("Empty command. Pass positional tokens or --json.");
      }

      const url = dbUrl.replace(/\/$/, "");
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${dbToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(args),
      });

      const data = await response.json() as { result?: unknown; error?: string };

      if (data.error) {
        throw new Error(data.error);
      }

      printJSON({ result: data.result });
    });
}

function parseJsonArgs(input: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error(`--json must be valid JSON; got: ${input}`);
  }
  if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === "string" || typeof x === "number" || typeof x === "boolean")) {
    throw new Error("--json must be a JSON array of strings/numbers/booleans.");
  }
  return parsed.map((x) => String(x));
}
