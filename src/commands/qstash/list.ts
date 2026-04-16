import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import type { QStashUser } from "../../types.js";

export function registerQStashList(qstash: Command): void {
  qstash
    .command("list")
    .description("List all QStash instances (id and region per deployment)")
    .action(async (flags: Record<string, never>, command: Command) => {
      const auth = resolveAuth(command);
      const users = await request<QStashUser[]>(auth, "GET", "/v2/qstash/users");
      printJSON(users);
    });
}
