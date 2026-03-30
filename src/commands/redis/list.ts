import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, printTable, handleError } from "../../output.js";
import type { Database } from "../../types.js";

interface Flags {
  email?: string;
  apiKey?: string;
  json?: boolean;
}

export function registerList(redis: Command): void {
  redis
    .command("list")
    .description("List all Redis databases")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        const dbs = await request<Database[]>(auth, "GET", "/v2/redis/databases");
        if (flags.json) {
          printJSON(dbs);
          return;
        }
        if (dbs.length === 0) {
          console.log("No databases found.");
          return;
        }
        printTable(
          ["ID", "NAME", "STATE", "REGION", "TYPE", "TLS"],
          dbs.map((db) => [
            db.database_id,
            db.database_name,
            db.state ?? "",
            db.primary_region ?? db.region ?? "",
            db.type ?? "",
            db.tls ? "yes" : "no",
          ]),
        );
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
