import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, printTable, handleError } from "../../output.js";
import type { QStashUser } from "../../types.js";

interface Flags {
  email?: string;
  apiKey?: string;
  json?: boolean;
}

export function registerQStashList(qstash: Command): void {
  qstash
    .command("list")
    .description("List all QStash instances (id and region per deployment)")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        const users = await request<QStashUser[]>(auth, "GET", "/v2/qstash/users");
        if (flags.json) {
          printJSON(users);
          return;
        }
        if (users.length === 0) {
          console.log("No QStash instances found.");
          return;
        }
        printTable(
          ["ID", "REGION", "STATE", "TYPE"],
          users.map((u) => [u.id, u.region ?? "", u.state ?? "", u.type ?? ""]),
        );
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
