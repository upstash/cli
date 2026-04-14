import { Command } from "commander";
import { printJSON } from "../../output.js";

interface Flags {
  dbUrl?: string;
  dbToken?: string;
  command: string;
}

export function registerExec(redis: Command): void {
  redis
    .command("exec")
    .description("Execute a Redis command against a database via the REST API")
    .option("--db-url <url>", "Database REST URL (overrides UPSTASH_REDIS_REST_URL)")
    .option("--db-token <token>", "Database REST token (overrides UPSTASH_REDIS_REST_TOKEN)")
    .requiredOption("--command <command>", 'Redis command to run (e.g. "SET key value")')
    .action(async (flags: Flags) => {
      const dbUrl = flags.dbUrl ?? process.env.UPSTASH_REDIS_REST_URL;
      const dbToken = flags.dbToken ?? process.env.UPSTASH_REDIS_REST_TOKEN;

      if (!dbUrl || !dbToken) {
        throw new Error(
          "Database credentials required. Provide --db-url and --db-token or set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables."
        );
      }

      const args = parseCommand(flags.command);
      if (args.length === 0) {
        throw new Error("Empty command");
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

export function parseCommand(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === undefined) break;

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === " " && !inSingle && !inDouble) {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }

  if (current.length > 0) args.push(current);
  return args;
}
