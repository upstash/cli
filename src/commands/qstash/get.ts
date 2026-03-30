import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";
import type { QStashUser } from "../../types.js";

export function registerQStashGet(qstash: Command): void {
  qstash
    .command("get")
    .description("Get details of a QStash instance")
    .requiredOption("--qstash-id <id>", "QStash instance ID")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { qstashId: string; email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      try {
        const q = await request<QStashUser>(auth, "GET", `/v2/qstash/user/${flags.qstashId}`);
        printJSON(q);
      } catch (err) {
        handleError(err);
      }
    });
}
