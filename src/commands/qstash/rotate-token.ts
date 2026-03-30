import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";
import type { QStashUser } from "../../types.js";

export function registerQStashRotateToken(qstash: Command): void {
  qstash
    .command("rotate-token")
    .description("Reset the authentication token for a QStash instance")
    .requiredOption("--qstash-id <id>", "QStash instance ID")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { qstashId: string; email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      try {
        const q = await request<QStashUser>(auth, "POST", `/v2/qstash/rotate-token/${flags.qstashId}`);
        printJSON(q);
      } catch (err) {
        handleError(err);
      }
    });
}
