import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, printKeyValue, handleError } from "../../output.js";
import type { QStashUser } from "../../types.js";

interface Flags { email?: string; apiKey?: string; json?: boolean }

export function registerQStashGet(qstash: Command): void {
  qstash
    .command("get <qstash-id>")
    .description("Get details of a QStash instance")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (qstashId: string, flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        const q = await request<QStashUser>(auth, "GET", `/v2/qstash/user/${qstashId}`);
        if (flags.json) { printJSON(q); return; }
        printKeyValue(q as unknown as Record<string, unknown>);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
