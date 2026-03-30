import { Command } from "commander";
import { printJSON, handleError } from "../../output.js";

interface Flags {
  dbUrl: string;
  dbToken: string;
  command: string;
}

export function registerExec(redis: Command): void {
  redis
    .command("exec")
    .description("Execute a Redis command against a database via the REST API")
    .requiredOption("--db-url <url>", "Database REST URL (e.g. https://xxx.upstash.io)")
    .requiredOption("--db-token <token>", "Database REST token")
    .requiredOption("--command <command>", 'Redis command to run (e.g. "SET key value")')
    .action(async (flags: Flags) => {
      const args = parseCommand(flags.command);
      if (args.length === 0) {
        handleError(new Error("Empty command"));
      }

      try {
        const url = flags.dbUrl.replace(/\/$/, "");
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${flags.dbToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(args),
        });

        const data = await response.json() as { result?: unknown; error?: string };

        if (data.error) {
          console.error(JSON.stringify({ error: data.error }));
          process.exit(1);
        }

        printJSON({ result: data.result });
      } catch (err) {
        handleError(err);
      }
    });
}

function parseCommand(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;

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
