import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import type { QStashUser } from "../../types.js";

export function registerQStashGet(qstash: Command): void {
  qstash
    .command("get")
    .description("Get details of a QStash instance")
    .requiredOption("--qstash-id <id>", "QStash instance ID")
    .action(async (flags: { qstashId: string }, command: Command) => {
      const auth = resolveAuth(command);
      const q = await request<QStashUser>(auth, "GET", `/v2/qstash/user/${flags.qstashId}`);
      printJSON(q);
    });
}
