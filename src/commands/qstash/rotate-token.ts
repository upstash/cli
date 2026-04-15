import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import type { QStashUser } from "../../types.js";

export function registerQStashRotateToken(qstash: Command): void {
  qstash
    .command("rotate-token")
    .description("Reset the authentication token for a QStash instance")
    .requiredOption("--qstash-id <id>", "QStash instance ID")
    .action(async (flags: { qstashId: string }, command: Command) => {
      const auth = resolveAuth(command);
      const q = await request<QStashUser>(auth, "POST", `/v2/qstash/rotate-token/${flags.qstashId}`);
      printJSON(q);
    });
}
