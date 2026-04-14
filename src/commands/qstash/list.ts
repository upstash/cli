import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import type { QStashUser } from "../../types.js";

export function registerQStashList(qstash: Command): void {
  qstash
    .command("list")
    .description("List all QStash instances (id and region per deployment)")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      const users = await request<QStashUser[]>(auth, "GET", "/v2/qstash/users");
      printJSON(users);
    });
}
